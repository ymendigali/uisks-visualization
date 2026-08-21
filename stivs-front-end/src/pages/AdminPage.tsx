import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../utils/metrics';
import './AdminPage.css';

type AdminTab = 'dashboard' | 'users';
type Role = 'admin' | 'editor' | 'viewer';
type UserStatus = 'active' | 'invited' | 'suspended';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  lastActive: string;
  permissions: number;
  tags: string[];
  location: string;
}

const ADMIN_USERS: AdminUser[] = [
  {
    id: 'u-101',
    name: 'Аружан Тастемир',
    email: 'aruzhan@uisks.kz',
    role: 'admin',
    status: 'active',
    lastActive: '2 ч назад',
    permissions: 18,
    tags: ['SAML', 'MFA'],
    location: 'Astana, KZ',
  },
  {
    id: 'u-102',
    name: 'Max Zhylkaidar',
    email: 'max@uisks.kz',
    role: 'editor',
    status: 'active',
    lastActive: '12 мин назад',
    permissions: 12,
    tags: ['API'],
    location: 'Almaty, KZ',
  },
  {
    id: 'u-103',
    name: 'Dana Nurkhan',
    email: 'dana@uisks.kz',
    role: 'viewer',
    status: 'invited',
    lastActive: '—',
    permissions: 6,
    tags: ['Analytics'],
    location: 'Shymkent, KZ',
  },
  {
    id: 'u-104',
    name: 'Samat Idrisov',
    email: 'sidrisov@uisks.kz',
    role: 'editor',
    status: 'active',
    lastActive: '46 мин назад',
    permissions: 11,
    tags: ['CMS'],
    location: 'Atyrau, KZ',
  },
  {
    id: 'u-105',
    name: 'Laura Bekturova',
    email: 'laura@uisks.kz',
    role: 'viewer',
    status: 'suspended',
    lastActive: '3 дня назад',
    permissions: 4,
    tags: ['API'],
    location: 'Aktobe, KZ',
  },
  {
    id: 'u-106',
    name: 'Aidar Mukhamed',
    email: 'aidar@uisks.kz',
    role: 'admin',
    status: 'active',
    lastActive: '8 мин назад',
    permissions: 20,
    tags: ['Security'],
    location: 'Astana, KZ',
  },
];

const visitSpark = [480, 520, 610, 580, 640, 710, 782];
const uniqueSpark = [360, 380, 402, 398, 412, 440, 468];
const sessionSpark = [5.8, 6.2, 6.9, 6.6, 7.1, 7.4, 7.7];
const bounceSpark = [42, 40, 39, 38, 36, 35, 34];
const sessionTrend = [1120, 1186, 1255, 1210, 1304, 1388, 1482];
const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface SparklineProps {
  data: number[];
  color: string;
}

const AdminSparkline: React.FC<SparklineProps> = ({ data, color }) => {
  if (!data.length) {
    return null;
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const divisor = Math.max(data.length - 1, 1);

  const points = data
    .map((value, index) => {
      const x = (index / divisor) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="admin-sparkline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
};

interface SessionsChartProps {
  data: number[];
  color?: string;
}

const SessionsTrendChart: React.FC<SessionsChartProps> = ({ data, color = '#2563eb' }) => {
  if (!data.length) {
    return null;
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const divisor = Math.max(data.length - 1, 1);

  const coordinates = data.map((value, index) => ({
    x: (index / divisor) * 100,
    y: 100 - ((value - min) / range) * 100,
  }));

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const areaPath = `${linePath} L 100 100 L 0 100 Z`;

  return (
    <svg className="admin-sessions-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d={areaPath} fill={`${color}20`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
};

const AdminPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [search, setSearch] = useState('');

  const summaryCards = useMemo(
    () => [
      {
        id: 'visits',
        label: t('admin_metric_total_visits'),
        value: '128 450',
        delta: '+8.4%',
        trend: 'up' as const,
        detail: t('admin_metric_vs_last_period'),
        spark: visitSpark,
        accent: '#2563eb',
      },
      {
        id: 'unique',
        label: t('admin_metric_unique_users'),
        value: '64 310',
        delta: '+5.1%',
        trend: 'up' as const,
        detail: t('admin_metric_vs_last_period'),
        spark: uniqueSpark,
        accent: '#16a34a',
      },
      {
        id: 'session',
        label: t('admin_metric_avg_session'),
        value: '7m 42s',
        delta: '+0.6%',
        trend: 'up' as const,
        detail: t('admin_metric_vs_last_period'),
        spark: sessionSpark,
        accent: '#f97316',
      },
      {
        id: 'bounce',
        label: t('admin_metric_bounce_rate'),
        value: '37.5%',
        delta: '-2.1%',
        trend: 'down' as const,
        detail: t('admin_metric_vs_last_period'),
        spark: bounceSpark,
        accent: '#a855f7',
      },
    ],
    [t],
  );

  const peakIndex = sessionTrend.indexOf(Math.max(...sessionTrend));
  const lowIndex = sessionTrend.indexOf(Math.min(...sessionTrend));

  const sessionStats = useMemo(
    () => [
      {
        label: t('admin_sessions_peak_label'),
        value: `${formatNumber(sessionTrend[peakIndex])} · ${weekDays[peakIndex]}`,
      },
      {
        label: t('admin_sessions_low_label'),
        value: `${formatNumber(sessionTrend[lowIndex])} · ${weekDays[lowIndex]}`,
      },
    ],
    [peakIndex, lowIndex, t],
  );

  const trafficSources = useMemo(
    () => [
      { id: 'organic', label: t('admin_source_organic'), value: 54, delta: '+6%' },
      { id: 'direct', label: t('admin_source_direct'), value: 22, delta: '+2%' },
      { id: 'referral', label: t('admin_source_referral'), value: 16, delta: '-1%' },
      { id: 'campaigns', label: t('admin_source_campaigns'), value: 8, delta: '+3%' },
    ],
    [t],
  );

  const securityFeed = useMemo(
    () => [
      { id: 'sec-1', label: t('admin_security_mfa'), time: '12:41', badge: 'ok' },
      { id: 'sec-2', label: t('admin_security_ip_blocked'), time: '11:18', badge: 'warn' },
      { id: 'sec-3', label: t('admin_security_password_reset'), time: '10:56', badge: 'info' },
      { id: 'sec-4', label: t('admin_security_role_change'), time: '09:47', badge: 'ok' },
    ],
    [t],
  );

  const roleLabels: Record<Role, string> = {
    admin: t('admin_users_role_admin'),
    editor: t('admin_users_role_editor'),
    viewer: t('admin_users_role_viewer'),
  };

  const statusLabels: Record<UserStatus, string> = {
    active: t('admin_status_active'),
    invited: t('admin_status_invited'),
    suspended: t('admin_status_suspended'),
  };

  const filteredUsers = useMemo(() => {
    return ADMIN_USERS.filter((user) => {
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        query.length === 0 ||
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query);
      return matchesRole && matchesSearch;
    });
  }, [roleFilter, search]);

  const totalUsers = ADMIN_USERS.length;
  const activeUsers = ADMIN_USERS.filter((user) => user.status === 'active').length;
  const pendingUsers = ADMIN_USERS.filter((user) => user.status === 'invited').length;

  const userStats = useMemo(
    () => [
      { label: t('admin_users_total_label'), value: totalUsers },
      { label: t('admin_users_active_label'), value: activeUsers },
      { label: t('admin_users_pending_label'), value: pendingUsers },
    ],
    [activeUsers, pendingUsers, t, totalUsers],
  );

  const roleFilters = [
    { id: 'all', label: t('admin_users_role_all') },
    { id: 'admin', label: t('admin_users_role_admin') },
    { id: 'editor', label: t('admin_users_role_editor') },
    { id: 'viewer', label: t('admin_users_role_viewer') },
  ];

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <p>{t('admin_page_subtitle')}</p>
          <h1>{t('admin_page_header')}</h1>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="admin-ghost" onClick={() => setSearch((prev) => prev)}>
            {t('admin_refresh_button')}
          </button>
          <button type="button" className="admin-primary">
            {t('admin_invite_button')}
          </button>
        </div>
      </header>

      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        {(['dashboard', 'users'] as AdminTab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            type="button"
            className={`admin-tab${activeTab === tab ? ' is-active' : ''}`}
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            <span>{t(tab === 'dashboard' ? 'admin_tab_dashboard' : 'admin_tab_users')}</span>
            {tab === 'users' && <small>{totalUsers}</small>}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <>
          <section className="admin-metrics-grid">
            {summaryCards.map((card) => (
              <article key={card.id} className="admin-metric-card">
                <header>
                  <span>{card.label}</span>
                  <span className={`admin-metric-trend ${card.trend === 'up' ? 'trend-up' : 'trend-down'}`}>
                    {card.delta}
                  </span>
                </header>
                <strong>{card.value}</strong>
                <p>{card.detail}</p>
                <AdminSparkline data={card.spark} color={card.accent} />
              </article>
            ))}
          </section>

          <section className="admin-panels-row">
            <article className="admin-panel admin-panel--stretch">
              <header>
                <div>
                  <p>{t('admin_sessions_chart_subtitle')}</p>
                  <h2>{t('admin_sessions_chart_title')}</h2>
                </div>
              </header>
              <SessionsTrendChart data={sessionTrend} />
              <div className="admin-session-stats">
                {sessionStats.map((item) => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="admin-panel">
              <header>
                <p>{t('admin_traffic_subtitle')}</p>
                <h2>{t('admin_traffic_title')}</h2>
              </header>
              <ul className="admin-traffic-list">
                {trafficSources.map((source) => (
                  <li key={source.id} className="admin-traffic-row">
                    <div>
                      <strong>{source.label}</strong>
                      <span>{source.delta}</span>
                    </div>
                    <div className="admin-progress-bar">
                      <span style={{ width: `${source.value}%` }} />
                    </div>
                    <small>{source.value}%</small>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="admin-panels-row">
            <article className="admin-panel">
              <header>
                <p>{t('admin_security_subtitle')}</p>
                <h2>{t('admin_security_title')}</h2>
              </header>
              <ul className="admin-security-feed">
                {securityFeed.map((event) => (
                  <li key={event.id} className={`admin-security-item badge-${event.badge}`}>
                    <div>
                      <strong>{event.label}</strong>
                      <span>{event.time}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </article>

            <article className="admin-panel">
              <header>
                <p>{t('admin_users_subtitle')}</p>
                <h2>{t('admin_users_title')}</h2>
              </header>
              <div className="admin-user-mini">
                {userStats.map((stat) => (
                  <div key={stat.label}>
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </>
      )}

      {activeTab === 'users' && (
        <section className="admin-users-panel">
          <div className="admin-users-toolbar">
            <div className="admin-role-filters" role="group" aria-label={t('admin_users_title')}>
              {roleFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={`admin-role-chip${roleFilter === filter.id ? ' is-active' : ''}`}
                  onClick={() => setRoleFilter(filter.id as Role | 'all')}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <label className="admin-users-search">
              <input
                type="search"
                placeholder={t('admin_users_search_placeholder')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>

          <div className="admin-users-stats">
            {userStats.map((stat) => (
              <div key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>

          <div className="admin-users-table-wrapper">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>{t('admin_users_col_name')}</th>
                  <th>{t('admin_users_col_email')}</th>
                  <th>{t('admin_users_col_role')}</th>
                  <th>{t('admin_users_col_status')}</th>
                  <th>{t('admin_users_col_last_active')}</th>
                  <th>{t('admin_users_col_permissions')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="admin-user-name">
                        <strong>{user.name}</strong>
                        <span>{user.location}</span>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`role-pill role-${user.role}`}>{roleLabels[user.role]}</span>
                    </td>
                    <td>
                      <span className={`status-pill status-${user.status}`}>{statusLabels[user.status]}</span>
                    </td>
                    <td>{user.lastActive}</td>
                    <td>{t('admin_users_permissions', { count: user.permissions })}</td>
                    <td className="admin-actions">
                      <button type="button" className="admin-link-button">
                        {t('admin_action_view')}
                      </button>
                      <button type="button" className="admin-link-button muted">
                        {t('admin_action_disable')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default AdminPage;
