import { useEffect, useState } from 'react';
import type { FinanceSummary } from '../api/types';
import { ApiError } from '../api/client';
import { financesApi } from '../api/services';

interface FinanceSummaryQuery {
  year?: number;
  startYear?: number;
  endYear?: number;
  region?: string;
  irn?: string;
  financingType?: string;
  cofinancing?: string;
  expense?: string;
  priority?: string;
  competition?: string;
  applicant?: string;
  customer?: string;
  status?: string;
}

export const useFinanceSummary = (query?: FinanceSummaryQuery) => {
  const [apiSummary, setApiSummary] = useState<FinanceSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadSummary = async () => {
      setIsSummaryLoading(true);
      setSummaryError(null);
      try {
        const summary = await financesApi.summary(query, controller.signal);
        setApiSummary(summary);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        const message = error instanceof ApiError ? error.message : 'Не удалось загрузить финансовую сводку с backend.';
        setSummaryError(message);
      } finally {
        setIsSummaryLoading(false);
      }
    };

    void loadSummary();

    return () => {
      controller.abort();
    };
  }, [
    query?.applicant,
    query?.cofinancing,
    query?.competition,
    query?.customer,
    query?.endYear,
    query?.expense,
    query?.financingType,
    query?.irn,
    query?.priority,
    query?.region,
    query?.startYear,
    query?.status,
    query?.year,
  ]);

  return {
    apiSummary,
    isSummaryLoading,
    summaryError,
  };
};
