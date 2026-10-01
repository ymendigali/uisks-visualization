import React, { useCallback, useEffect, useMemo, useState, useRef, type CSSProperties } from 'react';
import { CircleHelp, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Bar } from 'react-chartjs-2';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  LineController,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import KazakhstanMap from '../components/Home/KazakhstanMap';
import { useLocalRegionSelection } from '../hooks/useLocalRegionSelection';
import type { RegionId } from '../context/RegionContext';
import { formatNumber } from '../utils/metrics';
import './PublicationsPage.css';
import type { FilterOptionCountString, PublicationsAnalyticsQuery, PublicationsSummary } from '../api/types';
import { usePublicationsAnalytics } from '../hooks/usePublicationsAnalytics';
import { translatePriority } from '../utils/dataTranslations';
import PageLoader from '../components/PageLoader/PageLoader';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  LineController,
);

// Used until /analytics-filters reports the actual range of project periods.
const DEFAULT_YEAR_RANGE = { min: 2023, max: 2028 } as const;

interface FilterState {
  startYear: number | null;
  endYear: number | null;
  irn: string;
  financingType: string;
  priority: string;
  contest: string;
  applicant: string;
  customer: string;
  mrnti: string;
  status: string;
}

const defaultFilters: FilterState = {
  startYear: null,
  endYear: null,
  irn: 'all',
  financingType: 'all',
  priority: 'all',
  contest: 'all',
  applicant: 'all',
  customer: 'all',
  mrnti: 'all',
  status: 'all',
};

const emptySummary: PublicationsSummary = {
  total: 0,
  domestic: 0,
  foreign: 0,
  scopus: 0,
  wos: 0,
  patents: 0,
  implementations: 0,
  projects: 0,
};

type CSSVars = CSSProperties & { '--accent'?: string };

const getHighlightCards = (t: (key: string) => string, stats: PublicationsSummary) => [
  { id: 'total', label: t('publications_card_total'), value: formatNumber(stats.total), accent: '#1d4ed8' },
  { id: 'domestic', label: t('publications_card_domestic'), value: formatNumber(stats.domestic), accent: '#16a34a' },
  { id: 'foreign', label: t('publications_card_foreign'), value: formatNumber(stats.foreign), accent: '#7c3aed' },
  { id: 'scopus', label: t('publications_card_scopus'), value: formatNumber(stats.scopus), accent: '#4338ca' },
  { id: 'wos', label: t('publications_card_wos'), value: formatNumber(stats.wos), accent: '#0ea5e9' },
  { id: 'patents', label: t('publications_card_patents'), value: formatNumber(stats.patents), accent: '#ea580c' },
  {
    id: 'implementations',
    label: t('publications_card_implementations'),
    value: formatNumber(stats.implementations),
    accent: '#db2777',
  },
  { id: 'projects', label: t('publications_card_projects'), value: formatNumber(stats.projects), accent: '#059669' },
];

const toSelectOptions = (
  options: FilterOptionCountString[] | undefined,
  formatLabel: (value: string) => string = (value) => value,
) => (options ?? []).map((option) => ({ value: option.value, label: formatLabel(option.value) }));

const filterSelect = (
  id: string,
  label: string,
  value: string,
  options: Array<{ value: string; label: string }>,
  onChange: (next: string) => void,
  availableCount?: number,
) => (
  <label className="publications-filter-item" htmlFor={id} key={id}>
    <span>
      {label}
      {availableCount !== undefined ? (
        <small className="publications-filter-badge">доступно {availableCount}</small>
      ) : null}
    </span>
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const PublicationsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { selectedRegion, selectedRegionId, setSelectedRegionId, regions } = useLocalRegionSelection();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const statsScrollRef = useRef<HTMLDivElement | null>(null);
  const statsDragRef = useRef<{ pointerId: number | null; startX: number; scrollLeft: number }>(
    { pointerId: null, startX: 0, scrollLeft: 0 },
  );
  const [isDraggingStats, setIsDraggingStats] = useState(false);

  const [yearBounds, setYearBounds] = useState<{ min: number; max: number }>(DEFAULT_YEAR_RANGE);
  const startYear = filters.startYear ?? yearBounds.min;
  const endYear = filters.endYear ?? yearBounds.max;

  const analyticsQuery = useMemo<PublicationsAnalyticsQuery>(() => {
    const pick = (value: string) => (value === 'all' ? undefined : value);
    const isFullRange = startYear <= yearBounds.min && endYear >= yearBounds.max;
    return {
      region: selectedRegionId !== 'national' ? selectedRegion?.name : undefined,
      yearFrom: isFullRange ? undefined : startYear,
      yearTo: isFullRange ? undefined : endYear,
      irn: pick(filters.irn),
      financingType: pick(filters.financingType),
      priority: pick(filters.priority),
      contest: pick(filters.contest),
      applicant: pick(filters.applicant),
      customer: pick(filters.customer),
      mrnti: pick(filters.mrnti),
      status: pick(filters.status),
    };
  }, [filters, selectedRegion?.name, selectedRegionId, startYear, endYear, yearBounds]);

  const { filterOptions, data, isLoading, hasLoaded, loadError } = usePublicationsAnalytics(analyticsQuery);

  useEffect(() => {
    const min = filterOptions?.yearRange.min;
    const max = filterOptions?.yearRange.max;
    if (min && max && min < max) {
      setYearBounds({ min, max });
    }
  }, [filterOptions?.yearRange.min, filterOptions?.yearRange.max]);

  const irnOptions = useMemo(() => toSelectOptions(filterOptions?.irn), [filterOptions?.irn]);
  const financingTypeOptions = useMemo(() => toSelectOptions(filterOptions?.financingType), [filterOptions?.financingType]);
  const priorityOptions = useMemo(
    () => toSelectOptions(filterOptions?.priority, (value) => translatePriority(value, i18n.language)),
    [filterOptions?.priority, i18n.language],
  );
  const contestOptions = useMemo(() => toSelectOptions(filterOptions?.contest), [filterOptions?.contest]);
  const applicantOptions = useMemo(() => toSelectOptions(filterOptions?.applicant), [filterOptions?.applicant]);
  const customerOptions = useMemo(() => toSelectOptions(filterOptions?.customer), [filterOptions?.customer]);
  const mrntiOptions = useMemo(() => toSelectOptions(filterOptions?.mrnti), [filterOptions?.mrnti]);
  const statusOptions = useMemo(() => toSelectOptions(filterOptions?.status), [filterOptions?.status]);

  const handleRangeChange = (key: 'startYear' | 'endYear', value: number) => {
    setFilters((prev) => {
      const prevStart = prev.startYear ?? yearBounds.min;
      const prevEnd = prev.endYear ?? yearBounds.max;
      if (key === 'startYear') {
        return { ...prev, startYear: Math.min(value, prevEnd), endYear: prevEnd };
      }
      return { ...prev, startYear: prevStart, endYear: Math.max(value, prevStart) };
    });
  };

  const handleSelectChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setSelectedRegionId('national');
  };
  const handleStatsPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = statsScrollRef.current;
    if (!container) {
      return;
    }
    statsDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: container.scrollLeft,
    };
    container.setPointerCapture(event.pointerId);
    setIsDraggingStats(true);
  };

  const handleStatsPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingStats) {
      return;
    }
    const container = statsScrollRef.current;
    if (!container) {
      return;
    }
    const delta = event.clientX - statsDragRef.current.startX;
    container.scrollLeft = statsDragRef.current.scrollLeft - delta;
  };

  const stopStatsDragging = () => {
    if (!isDraggingStats) {
      return;
    }
    const container = statsScrollRef.current;
    const pointerId = statsDragRef.current.pointerId;
    if (container && pointerId !== null) {
      try {
        container.releasePointerCapture(pointerId);
      } catch {
        /* ignore cleanup errors */
      }
    }
    statsDragRef.current.pointerId = null;
    setIsDraggingStats(false);
  };

  const handleMapSelect = useCallback(
    (regionId: string) => {
      const typedId = regionId as RegionId;
      const nextRegionId = selectedRegionId === typedId ? 'national' : typedId;
      setSelectedRegionId(nextRegionId);
    },
    [selectedRegionId, setSelectedRegionId],
  );

  const rangeBackgroundStyle = useMemo(() => {
    const total = Math.max(yearBounds.max - yearBounds.min, 1);
    const startPercent = ((startYear - yearBounds.min) / total) * 100;
    const endPercent = ((endYear - yearBounds.min) / total) * 100;
    return {
      '--range-start': `${startPercent}%`,
      '--range-end': `${endPercent}%`,
    } as CSSProperties;
  }, [startYear, endYear, yearBounds]);

  const summary = data?.summary ?? emptySummary;
  const timeseries = useMemo(() => data?.timeseries ?? [], [data?.timeseries]);
  const timeseriesLabels = useMemo(() => timeseries.map((item) => String(item.year)), [timeseries]);

  const publicationDynamicsData = useMemo(
    () => ({
      labels: timeseriesLabels,
      datasets: [
        {
          label: t('publications_chart_domestic'),
          data: timeseries.map((item) => item.domestic),
          backgroundColor: '#1d4ed8',
          borderRadius: 10,
          stack: 'publications',
        },
        {
          label: t('publications_chart_foreign'),
          data: timeseries.map((item) => item.foreign),
          backgroundColor: '#60a5fa',
          borderRadius: 10,
          stack: 'publications',
        },
      ],
    }),
    [t, timeseries, timeseriesLabels],
  );

  const publicationDynamicsOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${formatNumber(Math.round(Number(context.raw)))}`,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: 'rgba(226,232,240,0.6)', drawBorder: false },
          ticks: {
            callback: (value) => formatNumber(Number(value)),
          },
        },
      },
    }),
    [],
  );

  const priorityPerformance = useMemo(
    () =>
      (data?.distributions.priorities ?? []).map((item) => ({
        label: translatePriority(item.priority, i18n.language),
        value: item.value,
      })),
    [data?.distributions.priorities, i18n.language],
  );

  const priorityChartData = useMemo(
    () => ({
      labels: priorityPerformance.map((item) => item.label),
      datasets: [
        {
          data: priorityPerformance.map((item) => item.value),
          backgroundColor: '#2563eb',
          borderRadius: 12,
          barThickness: 18,
        },
      ],
    }),
    [priorityPerformance]);

  const priorityChartOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${formatNumber(Number(context.raw))} публикаций`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: 'rgba(226,232,240,0.5)', drawBorder: false },
          ticks: {
            callback: (value) => `${formatNumber(Number(value))}`,
          },
        },
        y: {
          grid: { display: false },
        },
      },
    }),
    [],
  );

  const yearlyBarOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${formatNumber(Math.round(Number(context.raw)))}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: 'rgba(226,232,240,0.6)', drawBorder: false } },
      },
    }),
    [],
  );

  const implementationChartData = useMemo(
    () => ({
      labels: timeseriesLabels,
      datasets: [
        {
          label: t('publications_chart_implementations_projects'),
          data: timeseries.map((item) => item.implementations),
          backgroundColor: '#38bdf8',
          borderRadius: 12,
          maxBarThickness: 36,
        },
      ],
    }),
    [t, timeseries, timeseriesLabels],
  );

  const patentsChartData = useMemo(
    () => ({
      labels: timeseriesLabels,
      datasets: [
        {
          label: t('publications_chart_patents_label'),
          data: timeseries.map((item) => item.patents),
          backgroundColor: '#1d4ed8',
          borderRadius: 12,
          maxBarThickness: 32,
        },
        {
          label: t('publications_chart_deployments'),
          data: timeseries.map((item) => item.implementations),
          backgroundColor: '#0ea5e9',
          borderRadius: 12,
          maxBarThickness: 32,
        },
      ],
    }),
    [t, timeseries, timeseriesLabels],
  );

  const highlightCards = useMemo(() => getHighlightCards(t, summary), [t, summary]);
  const topApplicants = useMemo(
    () => (data?.distributions.topApplicants ?? []).map((item) => ({ id: item.name, ...item })),
    [data?.distributions.topApplicants],
  );
  const totalApplicantPublications = topApplicants.reduce((sum, applicant) => sum + applicant.value, 0);
  const isDataPending = !hasLoaded && isLoading;
  const isRefreshing = hasLoaded && isLoading;
  return (
    <div className="publications-page">
      <header className="publications-page-header">
        <div>
          <h1>{t('publications_page_heading')}</h1>
          <p>
            {t('publications_page_description')}
            {` Всего: ${formatNumber(summary.total)}`}
          </p>
          {loadError && <p>{loadError}</p>}
        </div>
        <div className="publications-header-actions">
          <button type="button" className="publications-export-button">
            <Download size={18} />
            {t('publications_export_button')}
          </button>
        </div>
      </header>

      <div className="publications-module-banner" role="status" aria-live="polite">
        модуль находится на стадии интеграции и тестирования
      </div>

      {isRefreshing && <PageLoader className="page-loader--inline" message="Обновление данных..." />}

      {isDataPending ? (
        <PageLoader />
      ) : (
      <>
      <section className="publications-stats-row" aria-label={t('publications_stats_aria')}>
        <div
          className={`publications-stats-scroll${isDraggingStats ? ' is-dragging' : ''}`}
          ref={statsScrollRef}
          onPointerDown={handleStatsPointerDown}
          onPointerMove={handleStatsPointerMove}
          onPointerUp={stopStatsDragging}
          onPointerCancel={stopStatsDragging}
          onPointerLeave={stopStatsDragging}
        >
          {highlightCards.map((card) => (
            <article
              key={card.id}
              className="publications-stat-card"
              style={{ '--accent': card.accent } as CSSVars}
            >
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="publications-map-and-filter">
        <article className="publications-map-panel">
          <header>
            <div>
              <p>{t('publications_map_title')}</p>
              <h2>{selectedRegion?.name ?? t('republic_kazakhstan')}</h2>
            </div>
            <small>{t('publications_map_hint')}</small>
          </header>
          <div className="publications-map-wrapper">
            <KazakhstanMap selectedRegionId={selectedRegionId} onRegionSelect={handleMapSelect} />
          </div>
        </article>

        <article className="publications-filters-panel">
          <header>
            <h2>{t('publications_filters_title')}</h2>
          </header>

          <section className="publications-filter-group" aria-label={t('publications_filters_years_aria')}>
            <div className="publications-filter-title">{t('publications_filters_years_title')}</div>
            <div className="period-range-slider" style={rangeBackgroundStyle}>
              <div className="period-range-values">
                <span className="period-range-value">{startYear}</span>
                <span className="period-range-value">{endYear}</span>
              </div>
              <div className="period-range-track" />
              <div className="period-range-inputs">
                <input
                  type="range"
                  min={yearBounds.min}
                  max={yearBounds.max}
                  value={startYear}
                  onChange={(event) => handleRangeChange('startYear', Number(event.target.value))}
                  className="period-range-thumb"
                />
                <input
                  type="range"
                  min={yearBounds.min}
                  max={yearBounds.max}
                  value={endYear}
                  onChange={(event) => handleRangeChange('endYear', Number(event.target.value))}
                  className="period-range-thumb period-range-thumb--upper"
                />
              </div>
            </div>
          </section>

          <div className="publications-filter-grid">
            {filterSelect(
              'filter-irn',
              t('projects_label_irn'),
              filters.irn,
              [{ value: 'all', label: t('projects_filter_irn') }, ...irnOptions],
              (value) => handleSelectChange('irn', value),
              irnOptions.length,
            )}
            {filterSelect(
              'filter-financing',
              t('pub_filter_financing_type'),
              filters.financingType,
              [{ value: 'all', label: t('fin_all_types') }, ...financingTypeOptions],
              (value) => handleSelectChange('financingType', value),
              financingTypeOptions.length,
            )}
            {filterSelect(
              'filter-priority',
              t('pub_filter_priority_direction'),
              filters.priority,
              [{ value: 'all', label: t('pub_priority_all') }, ...priorityOptions],
              (value) => handleSelectChange('priority', value),
              priorityOptions.length,
            )}
            {filterSelect(
              'filter-contest',
              t('pub_filter_contest_name'),
              filters.contest,
              [{ value: 'all', label: t('pub_contests_all') }, ...contestOptions],
              (value) => handleSelectChange('contest', value),
              contestOptions.length,
            )}
            {filterSelect(
              'filter-applicant',
              t('pub_filter_applicant'),
              filters.applicant,
              [{ value: 'all', label: t('pub_applicants_all') }, ...applicantOptions],
              (value) => handleSelectChange('applicant', value),
              applicantOptions.length,
            )}
            {filterSelect(
              'filter-customer',
              t('pub_filter_customer'),
              filters.customer,
              [{ value: 'all', label: t('pub_customers_all') }, ...customerOptions],
              (value) => handleSelectChange('customer', value),
              customerOptions.length,
            )}
            {filterSelect(
              'filter-mrnti',
              t('pub_filter_mrnti'),
              filters.mrnti,
              [{ value: 'all', label: t('fin_all_types') }, ...mrntiOptions],
              (value) => handleSelectChange('mrnti', value),
              mrntiOptions.length,
            )}
            {filterSelect(
              'filter-status',
              t('pub_filter_status'),
              filters.status,
              [{ value: 'all', label: t('pub_status_all') }, ...statusOptions],
              (value) => handleSelectChange('status', value),
              statusOptions.length,
            )}
            <label className="publications-filter-item" htmlFor="filter-region">
              <span>
                {t('pub_filter_region')}
                <small className="publications-filter-badge">доступно {regions.length}</small>
              </span>
              <select
                id="filter-region"
                value={selectedRegionId}
                onChange={(event) => setSelectedRegionId(event.target.value as RegionId)}
              >
                <option value="national">{t('pub_region_all')}</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="publications-filter-actions">
            <button type="button" onClick={handleResetFilters}>{t('pub_button_reset_filters')}</button>
          </div>
        </article>
      </section>
      <section className="publications-chart-grid">
        <article className="publications-chart-card chart-span-2">
          <header>
            <h3>{t('publications_chart_dynamics')}</h3>
            <p>{t('publications_chart_dynamics_subtitle')}</p>
          </header>
          <div className="chart-body">
            <Bar data={publicationDynamicsData} options={publicationDynamicsOptions} />
          </div>
        </article>

        <article className="publications-chart-card">
          <header>
            <h3>
              {t('publications_chart_scopus')}
              <span className="publications-inline-help publications-inline-help--align-right">
                <button
                  type="button"
                  className="publications-inline-help-button"
                  aria-label={t('publications_chart_scopus_help_aria')}
                >
                  <CircleHelp size={14} />
                </button>
                <span className="publications-inline-help-tooltip" role="tooltip">
                  <p>{t('publications_chart_scopus_help_p1')}</p>
                  <p>{t('publications_chart_scopus_help_p2')}</p>
                  <p>{t('publications_chart_scopus_help_p3')}</p>
                </span>
              </span>
            </h3>
          </header>
          <div className="chart-body">
            <div className="publications-chart-empty">{t('publications_no_source_data')}</div>
          </div>
        </article>

        <article className="publications-chart-card">
          <header>
            <h3>
              {t('publications_chart_wos')}
              <span className="publications-inline-help publications-inline-help--align-right">
                <button
                  type="button"
                  className="publications-inline-help-button"
                  aria-label={t('publications_chart_wos_help_aria')}
                >
                  <CircleHelp size={14} />
                </button>
                <span className="publications-inline-help-tooltip" role="tooltip">
                  <p>{t('publications_chart_wos_help_p1')}</p>
                  <p>{t('publications_chart_wos_help_p2')}</p>
                  <ul>
                    <li>{t('publications_chart_wos_help_li1')}</li>
                    <li>{t('publications_chart_wos_help_li2')}</li>
                  </ul>
                  <p>{t('publications_chart_wos_help_p3')}</p>
                </span>
              </span>
            </h3>
          </header>
          <div className="chart-body">
            <div className="publications-chart-empty">{t('publications_no_source_data')}</div>
          </div>
        </article>
      </section>

      <section className="publications-chart-grid">
        <article className="publications-chart-card chart-span-2">
          <header>
            <p>{t('publications_chart_priority_subtitle')}</p>
          </header>
          <div className="chart-body">
            <Bar data={priorityChartData} options={priorityChartOptions} />
          </div>
        </article>

        <article className="publications-chart-card chart-span-2">
          <header>
            <h3>
              {t('publications_chart_implementation')}
              <span className="publications-inline-help publications-inline-help--align-right">
                <button
                  type="button"
                  className="publications-inline-help-button"
                  aria-label={t('publications_chart_implementation_help_aria')}
                >
                  <CircleHelp size={14} />
                </button>
                <span className="publications-inline-help-tooltip" role="tooltip">
                  <p><strong>{t('publications_chart_implementation_help_title')}</strong></p>
                  <p>{t('publications_chart_implementation_help_p1')}</p>
                  <p>{t('publications_chart_implementation_help_p2')}</p>
                </span>
              </span>
            </h3>
          </header>
          <div className="chart-body">
            <Bar data={implementationChartData} options={yearlyBarOptions} />
          </div>
        </article>
      </section>

      <section className="publications-chart-grid">
        <article className="publications-chart-card chart-span-2">
          <header>
            <h3>{t('publications_chart_applicants')}</h3>
          </header>
          <div className="top-applicants-list">
            {topApplicants.map((applicant) => {
              const share = totalApplicantPublications > 0 ? (applicant.value / totalApplicantPublications) * 100 : 0;
              return (
                <div key={applicant.id} className="top-applicant-row">
                  <div>
                    <strong>{applicant.name}</strong>
                    <span>{formatNumber(applicant.value)}</span>
                  </div>
                  <div className="top-applicant-bar">
                    <span style={{ width: `${share}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="top-applicant-total">
              <span>{t('publications_top_applicants_total')}</span>
              <strong>{formatNumber(totalApplicantPublications)}</strong>
            </div>
          </div>
        </article>

        <article className="publications-chart-card chart-span-2">
          <header>
            <h3>{t('publications_chart_patents')}</h3>
            <p>{t('publications_chart_patents_subtitle')}</p>
          </header>
          <div className="chart-body">
            <Bar data={patentsChartData} options={yearlyBarOptions} />
          </div>
        </article>
      </section>
      </>
      )}
    </div>
  );
};

export default PublicationsPage;