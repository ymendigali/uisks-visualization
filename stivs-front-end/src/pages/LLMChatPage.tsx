import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Send,
  Loader2,
  Link as LinkIcon,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  RefreshCcw,
} from 'lucide-react';
import './LLMChatPage.css';

const CHAT_ENDPOINT = (import.meta.env.VITE_LLM_CHAT_ENDPOINT as string | undefined) ?? '/api/llm/jobs.php';
const STATUS_ENDPOINT = (import.meta.env.VITE_LLM_STATUS_ENDPOINT as string | undefined) ?? '/api/llm/status.php';
const CALLBACK_URL = (import.meta.env.VITE_LLM_CALLBACK_URL as string | undefined) ?? '';

type RequestStatus = 'queued' | 'processing' | 'ready' | 'failed' | 'done';

type ChatRole = 'user' | 'system';

type LLMCallbackPayload = {
  requestId: string;
  status: RequestStatus;
  fileUrl?: string;
  detail?: string;
  progress?: number;
  timestamp?: string;
};

type CreateRequestResponse = {
  job_id: string;
  status?: string;
  status_url?: string;
  download_url?: string;
  callback_url?: string;
  message?: string;
};

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  requestId?: string;
  status?: RequestStatus;
  fileUrl?: string;
  detail?: string;
};

type RequestEvent = {
  id: string;
  status: RequestStatus;
  timestamp: string;
  detail?: string;
  fileUrl?: string;
};

type LLMRequest = {
  id: string;
  prompt: string;
  status: RequestStatus;
  createdAt: string;
  lastUpdate: string;
  statusUrl?: string;
  downloadUrl?: string;
  events: RequestEvent[];
  fileUrl?: string;
};

const LLM_CHAT_MESSAGES_STORAGE_KEY = 'uisks.llm.chatMessages';
const LLM_CHAT_REQUESTS_STORAGE_KEY = 'uisks.llm.requests';

const normalizeStatus = (status?: string): RequestStatus => {
  if (!status) {
    return 'queued';
  }

  if (status === 'queued') {
    return 'queued';
  }

  if (status === 'done') {
    return 'ready';
  }

  if (status === 'ready') {
    return 'ready';
  }

  if (status === 'processing') {
    return 'processing';
  }

  if (status === 'failed') {
    return 'failed';
  }

  if (status === 'error') {
    return 'failed';
  }

  return 'queued';
};

const trimTrailingSlash = (value: string) => value?.replace(/\/$/, '') ?? '';

const normalizeLlmApiUrl = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const normalizedPath = (path: string) =>
    path
      .replace(/\/api\/(status|download)\.php$/i, '/api/llm/$1.php')
      .replace(/\/api\/v1\/llm\/(jobs|status|download)\.php$/i, '/api/llm/$1.php')
      .replace(/\/api\/llm\/(jobs|status|download)\.php$/i, '/api/llm/$1.php');

  try {
    const baseOrigin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost';
    const parsedUrl = new URL(value, baseOrigin);
    parsedUrl.pathname = normalizedPath(parsedUrl.pathname);

    if (typeof window !== 'undefined' && window.location?.origin) {
      if (window.location.protocol === 'https:' && parsedUrl.protocol === 'http:') {
        parsedUrl.protocol = 'https:';
      }

      if (parsedUrl.host === window.location.host) {
        return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
      }
    }

    return parsedUrl.toString();
  } catch {
    const fallback = value
      .replace(/\/api\/(status|download)\.php(?=\?|#|$)/i, '/api/llm/$1.php')
      .replace(/\/api\/v1\/llm\/(jobs|status|download)\.php(?=\?|#|$)/i, '/api/llm/$1.php')
      .replace(/\/api\/llm\/(jobs|status|download)\.php(?=\?|#|$)/i, '/api/llm/$1.php');
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && fallback.startsWith('http://')) {
      return fallback.replace(/^http:\/\//i, 'https://');
    }
    return fallback;
  }
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `llm-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const renderStatusIcon = (status: RequestStatus) => {
  switch (status) {
    case 'queued':
      return <Clock size={16} />;
    case 'processing':
      return <Loader2 size={16} className="llm-spin" />;
    case 'ready':
      return <CheckCircle2 size={16} />;
    case 'failed':
      return <AlertTriangle size={16} />;
    default:
      return null;
  }
};

const isRequestStatus = (value: unknown): value is RequestStatus =>
  value === 'queued' || value === 'processing' || value === 'ready' || value === 'failed' || value === 'done';

const loadStoredChatMessages = (): ChatMessage[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LLM_CHAT_MESSAGES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => {
        const role: ChatRole = item.role === 'user' ? 'user' : 'system';
        return {
          id: typeof item.id === 'string' ? item.id : generateId(),
          role,
          content: typeof item.content === 'string' ? item.content : '',
          timestamp: typeof item.timestamp === 'string' ? item.timestamp : new Date().toISOString(),
          requestId: typeof item.requestId === 'string' ? item.requestId : undefined,
          status: isRequestStatus(item.status) ? item.status : undefined,
          fileUrl: typeof item.fileUrl === 'string' ? item.fileUrl : undefined,
          detail: typeof item.detail === 'string' ? item.detail : undefined,
        };
      })
      .filter((item) => item.content.length > 0);
  } catch {
    return [];
  }
};

const loadStoredRequests = (): LLMRequest[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LLM_CHAT_REQUESTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => {
        const eventsRaw = Array.isArray(item.events) ? item.events : [];
        const events: RequestEvent[] = eventsRaw
          .filter((event): event is Record<string, unknown> => typeof event === 'object' && event !== null)
          .map((event) => ({
            id: typeof event.id === 'string' ? event.id : generateId(),
            status: isRequestStatus(event.status) ? event.status : 'queued',
            timestamp: typeof event.timestamp === 'string' ? event.timestamp : new Date().toISOString(),
            detail: typeof event.detail === 'string' ? event.detail : undefined,
            fileUrl: typeof event.fileUrl === 'string' ? normalizeLlmApiUrl(event.fileUrl) : undefined,
          }));

        return {
          id: typeof item.id === 'string' ? item.id : generateId(),
          prompt: typeof item.prompt === 'string' ? item.prompt : '',
          status: isRequestStatus(item.status) ? item.status : 'queued',
          createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
          lastUpdate: typeof item.lastUpdate === 'string' ? item.lastUpdate : new Date().toISOString(),
          statusUrl: typeof item.statusUrl === 'string' ? normalizeLlmApiUrl(item.statusUrl) : undefined,
          downloadUrl: typeof item.downloadUrl === 'string' ? normalizeLlmApiUrl(item.downloadUrl) : undefined,
          events,
          fileUrl: typeof item.fileUrl === 'string' ? normalizeLlmApiUrl(item.fileUrl) : undefined,
        };
      })
      .filter((item) => item.prompt.length > 0);
  } catch {
    return [];
  }
};

const LLMChatPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => loadStoredChatMessages());
  const [requests, setRequests] = useState<LLMRequest[]>(() => loadStoredRequests());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const pollersRef = useRef<Record<string, number>>({});

  const requestStatusToLabel = useCallback((status: RequestStatus) => {
    switch (status) {
      case 'queued':
        return t('llm_chat_status_queued');
      case 'processing':
        return t('llm_chat_status_processing');
      case 'ready':
      case 'done':
        return t('llm_chat_status_ready');
      case 'failed':
        return t('llm_chat_status_failed');
      default:
        return status;
    }
  }, [t]);

  const stopPolling = useCallback((requestId: string) => {
    const pollerId = pollersRef.current[requestId];
    if (pollerId) {
      clearInterval(pollerId);
      delete pollersRef.current[requestId];
    }
  }, []);

  const handleIncomingPayload = useCallback((payload: LLMCallbackPayload) => {
    const normalizedStatus = normalizeStatus(payload.status);
    const normalizedFileUrl = normalizeLlmApiUrl(payload.fileUrl);

    setRequests((prev) => prev.map((request) => {
      if (request.id !== payload.requestId) {
        return request;
      }

      const timestamp = payload.timestamp ?? new Date().toISOString();
      const event: RequestEvent = {
        id: generateId(),
        status: normalizedStatus,
        timestamp,
        detail: payload.detail,
        fileUrl: payload.fileUrl,
      };

      const nextEvents = [event, ...request.events];
      const nextRequest: LLMRequest = {
        ...request,
        status: normalizedStatus,
        lastUpdate: timestamp,
        events: nextEvents,
        fileUrl: normalizedFileUrl ?? request.fileUrl,
      };

      return nextRequest;
    }));

    if (normalizedStatus === 'ready' && normalizedFileUrl) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'system',
          content: t('llm_chat_message_ready'),
          timestamp: new Date().toISOString(),
          requestId: payload.requestId,
          status: normalizedStatus,
          fileUrl: normalizedFileUrl,
          detail: payload.detail,
        },
      ]);
      stopPolling(payload.requestId);
    }

    if (normalizedStatus === 'failed') {
      setChatMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'system',
          content: t('llm_chat_message_failed'),
          timestamp: new Date().toISOString(),
          requestId: payload.requestId,
          status: normalizedStatus,
          detail: payload.detail,
        },
      ]);
      stopPolling(payload.requestId);
    }
  }, [stopPolling, t]);

  const pollStatus = useCallback((requestId: string, statusUrl?: string) => {
    if (!STATUS_ENDPOINT && !statusUrl) {
      return;
    }

    stopPolling(requestId);
    const base = statusUrl ? trimTrailingSlash(statusUrl) : trimTrailingSlash(STATUS_ENDPOINT);
    const url = statusUrl ? base : `${base}?job_id=${encodeURIComponent(requestId)}`;

    const pollerId = window.setInterval(async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Status request failed');
        }

        const payload = await response.json() as Record<string, unknown>;
        const status = normalizeStatus(typeof payload.status === 'string' ? payload.status : undefined);
        if (status) {
          handleIncomingPayload({
            requestId,
            status,
            fileUrl: typeof payload.download_url === 'string' ? payload.download_url : undefined,
            detail: typeof payload.detail === 'string' ? payload.detail : undefined,
            timestamp: typeof payload.updated_at === 'string' ? payload.updated_at : new Date().toISOString(),
          });
        }
      } catch {
        // polling error — silently ignored, will retry on next tick
      }
    }, 4500);

    pollersRef.current[requestId] = pollerId;
  }, [handleIncomingPayload, stopPolling]);

  const appendUserMessage = useCallback((prompt: string) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: 'user',
        content: prompt,
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  const appendSystemMessage = useCallback((content: string, requestId?: string) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: 'system',
        content,
        timestamp: new Date().toISOString(),
        requestId,
      },
    ]);
  }, []);

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const trimmed = inputValue.trim();
    if (!trimmed || isSubmitting) {
      return;
    }

    appendUserMessage(trimmed);
    setIsSubmitting(true);

    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: trimmed,
          locale: i18n.language,
          ...(CALLBACK_URL ? { callback_url: CALLBACK_URL } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create request');
      }

      const data = await response.json() as CreateRequestResponse;
      const requestId = data.job_id;
      const createdAt = new Date().toISOString();
      const initialStatus: RequestStatus = normalizeStatus(data.status);
      const normalizedStatusUrl = normalizeLlmApiUrl(data.status_url);
      const normalizedDownloadUrl = normalizeLlmApiUrl(data.download_url);

      const newRequest: LLMRequest = {
        id: requestId,
        prompt: trimmed,
        status: initialStatus,
        createdAt,
        lastUpdate: createdAt,
        statusUrl: normalizedStatusUrl,
        downloadUrl: normalizedDownloadUrl,
        events: [
          {
            id: generateId(),
            status: initialStatus,
            timestamp: createdAt,
            detail: data.message ?? t('llm_chat_request_created'),
          },
        ],
        fileUrl: normalizedDownloadUrl,
      };

      setRequests((prev) => [newRequest, ...prev]);
      appendSystemMessage(t('llm_chat_request_registered'), requestId);

      // Always poll, because callback endpoint is reachable only inside the tunnel.
      pollStatus(requestId, newRequest.statusUrl);

      setInputValue('');
    } catch {
      setFormError(t('llm_chat_request_failed'));
      appendSystemMessage(t('llm_chat_request_failed'));
    } finally {
      setIsSubmitting(false);
    }
  }, [appendSystemMessage, appendUserMessage, i18n.language, inputValue, pollStatus, t, isSubmitting]);

  useEffect(() => () => {
    Object.values(pollersRef.current).forEach((intervalId) => {
      clearInterval(intervalId);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(LLM_CHAT_MESSAGES_STORAGE_KEY, JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(LLM_CHAT_REQUESTS_STORAGE_KEY, JSON.stringify(requests));
  }, [requests]);

  useEffect(() => {
    requests.forEach((request) => {
      if (request.status === 'queued' || request.status === 'processing') {
        pollStatus(request.id, request.statusUrl);
      }
    });
  }, [pollStatus, requests]);

  return (
    <div className="llm-chat-page">
      <section className="llm-hero">
        <div className="llm-hero-header">
          <p className="llm-kicker">{t('llm_chat_kicker')}</p>
          <h1>{t('llm_chat_title')}</h1>
          <p className="llm-subtitle">{t('llm_chat_subtitle')}</p>
        </div>
        <div className="llm-hero-grid">
          <div className="llm-meta">
            <div className="llm-meta-card">
              <ShieldCheck size={20} />
              <span>{t('llm_chat_meta_secure')}</span>
            </div>
            <div className="llm-meta-card">
              <FileText size={20} />
              <span>{t('llm_chat_meta_docs')}</span>
            </div>
            <div className="llm-meta-card">
              <RefreshCcw size={20} />
              <span>{t('llm_chat_meta_async')}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="llm-module-banner" role="status" aria-live="polite">
        модуль находится на стадии интеграции и тестирования
      </div>

      <div className="llm-grid">
        <section className="llm-chat-panel" aria-label={t('llm_chat_panel_label')}>
          <div className="llm-chat-window">
            {chatMessages.length === 0 ? (
              <div className="llm-chat-empty">
                <p>{t('llm_chat_empty_state')}</p>
              </div>
            ) : (
              chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`llm-message llm-message-${message.role}`}
                >
                  <div className="llm-message-meta">
                    <span>{message.role === 'user' ? t('llm_chat_user_label') : t('llm_chat_system_label')}</span>
                    <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p>{message.content}</p>
                  {message.detail && <p className="llm-message-detail">{message.detail}</p>}
                  {message.fileUrl && (
                    <a href={message.fileUrl} target="_blank" rel="noreferrer" className="llm-file-link">
                      <FileText size={16} />
                      <span>{t('llm_chat_open_file')}</span>
                    </a>
                  )}
                  {message.status && (
                    <span className={`llm-status-badge status-${message.status}`}>
                      {renderStatusIcon(message.status)}
                      {requestStatusToLabel(message.status)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          <form className="llm-chat-form" onSubmit={handleSubmit}>
            <label htmlFor="llmPrompt" className="sr-only">
              {t('llm_chat_input_label')}
            </label>
            <textarea
              id="llmPrompt"
              placeholder={t('llm_chat_input_placeholder')}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              rows={4}
              disabled={isSubmitting}
            />
            {formError && <p className="llm-error-text">{formError}</p>}
            <div className="llm-form-actions">
              <button type="submit" className="llm-send-button" disabled={isSubmitting || !inputValue.trim()}>
                {isSubmitting ? <Loader2 size={18} className="llm-spin" /> : <Send size={18} />}
                <span>{t('llm_chat_send_button')}</span>
              </button>
            </div>
          </form>
        </section>

        <section className="llm-status-panel" aria-label={t('llm_chat_status_panel_label')}>
          <div className="llm-panel-header">
            <div>
              <p className="llm-panel-kicker">{t('llm_chat_requests_kicker')}</p>
              <h2>{t('llm_chat_requests_title')}</h2>
            </div>
            <p className="llm-panel-meta">{t('llm_chat_requests_hint')}</p>
          </div>

          {requests.length === 0 ? (
            <div className="llm-status-empty">
              <p>{t('llm_chat_no_requests')}</p>
            </div>
          ) : (
            <ul className="llm-requests-list">
              {requests.map((request) => (
                <li key={request.id} className="llm-request-card">
                  <div className="llm-request-header">
                    <div>
                      <p className="llm-request-id">{request.id}</p>
                      <p className="llm-request-prompt">{request.prompt}</p>
                    </div>
                    <span className={`llm-status-badge status-${request.status}`}>
                      {renderStatusIcon(request.status)}
                      {requestStatusToLabel(request.status)}
                    </span>
                  </div>
                  <div className="llm-request-meta">
                    <span>{t('llm_chat_created_at', { value: new Date(request.createdAt).toLocaleString() })}</span>
                    <span>{t('llm_chat_updated_at', { value: new Date(request.lastUpdate).toLocaleString() })}</span>
                  </div>
                  {request.fileUrl && (
                    <a href={request.fileUrl} target="_blank" rel="noreferrer" className="llm-file-pill">
                      <FileText size={16} />
                      <span>{t('llm_chat_download_file')}</span>
                    </a>
                  )}
                  <ul className="llm-events">
                    {request.events.map((event) => (
                      <li key={event.id}>
                        <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                        <p>{event.detail ?? requestStatusToLabel(event.status)}</p>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}

          <div className="llm-integration-card">
            <p>{t('llm_chat_integration_title')}</p>
            <div className="llm-endpoints">
              <div>
                <span>{t('llm_chat_endpoint_requests')}</span>
                <code>{CHAT_ENDPOINT}</code>
              </div>
              <div>
                <span>{t('llm_chat_endpoint_status')}</span>
                <code>{STATUS_ENDPOINT}</code>
              </div>
            </div>
            <p className="llm-integration-hint">
              <LinkIcon size={16} />
              <span>{t('llm_chat_integration_hint')}</span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LLMChatPage;
