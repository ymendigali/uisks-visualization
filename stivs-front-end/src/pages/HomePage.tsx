import React, { useEffect, useMemo, useState } from 'react';
import { Cpu, Users2, FileText, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import KazakhstanMap from '../components/Home/KazakhstanMap';
import { regionsData } from '../components/Home/regionsData';
import { useRegionContext } from '../context/RegionContext';
import type { RegionId } from '../context/RegionContext';
import { calculateNationalMetrics, formatNumber } from '../utils/metrics';
import './HomePage.css';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client';
import { dashboardApi } from '../api/services';
import type { DashboardFilterOptions, DashboardSummary } from '../api/types';
import PageLoader from '../components/PageLoader/PageLoader';

const HOME_YEAR_RANGE = { min: 2020, max: 2025 } as const;

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const { selectedRegionId, selectedRegion, setSelectedRegionId } = useRegionContext();
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [dashboardFilters, setDashboardFilters] = useState<DashboardFilterOptions>({ priority: [], applicant: [] });
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [isFiltersLoading, setIsFiltersLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(HOME_YEAR_RANGE.max);
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [selectedOrganization, setSelectedOrganization] = useState<string>('');

  const yearOptions = useMemo(
    () =>
      Array.from({ length: HOME_YEAR_RANGE.max - HOME_YEAR_RANGE.min + 1 }, (_, index) => HOME_YEAR_RANGE.max - index),
    [],
  );

  useEffect(() => {
    const loadDashboardFilters = async () => {
      setIsFiltersLoading(true);
      try {
        const filters = await dashboardApi.filters();
        setDashboardFilters(filters);
      } catch {
        setDashboardFilters({ priority: [], applicant: [] });
      } finally {
        setIsFiltersLoading(false);
      }
    };

    void loadDashboardFilters();
  }, []);

  const normalizedNoFilterValues = useMemo(() => {
    const normalizeFilterValue = (value: string) => value.trim().toLowerCase();

    return new Set([
      '',
      normalizeFilterValue(t('filter_select_direction')),
      normalizeFilterValue(t('filter_select_organization')),
      normalizeFilterValue('Все направления'),
      normalizeFilterValue('Выбор организации'),
      normalizeFilterValue('All directions'),
      normalizeFilterValue('Choose organization'),
    ]);
  }, [t]);

  const normalizeDashboardFilterValue = (value: string) => value.trim().toLowerCase();

  const asDashboardFilterParam = (value: string): string | undefined => {
    if (!value) {
      return undefined;
    }

    return normalizedNoFilterValues.has(normalizeDashboardFilterValue(value)) ? undefined : value;
  };

  useEffect(() => {
    const loadDashboardSummary = async () => {
      setIsDashboardLoading(true);
      setDashboardError(null);
      try {
        const yearForRequest =
          selectedYear >= HOME_YEAR_RANGE.min && selectedYear <= HOME_YEAR_RANGE.max
            ? selectedYear
            : undefined;
        const summary = await dashboardApi.summary({
          priority: asDashboardFilterParam(selectedPriority),
          organization: asDashboardFilterParam(selectedOrganization),
          region: selectedRegion?.name ?? 'all',
          year: yearForRequest,
        });
        setDashboardSummary(summary);
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'Не удалось загрузить сводку главной страницы.';
        setDashboardError(message);
        setDashboardSummary(null);
      } finally {
        setIsDashboardLoading(false);
      }
    };

    void loadDashboardSummary();
  }, [selectedOrganization, selectedPriority, selectedRegion?.name, selectedYear]);

  const nationalMetrics = useMemo(() => calculateNationalMetrics(), []);
  const metrics = useMemo(() => {
    if (!dashboardSummary) {
      return selectedRegion?.stats ?? nationalMetrics;
    }

    return {
      projects: dashboardSummary.projects,
      publications: dashboardSummary.publications,
      people: dashboardSummary.people,
      finances: dashboardSummary.finances,
    };
  }, [dashboardSummary, nationalMetrics, selectedRegion?.stats]);

  const handleRegionSelect = (regionId: string) => {
    const nextRegionId: RegionId = selectedRegionId === regionId ? 'national' : (regionId as RegionId);
    setSelectedRegionId(nextRegionId);
  };

  const summaryCards = useMemo(
    () => [
      {
        title: t('card_projects_title'),
        icon: <Cpu size={40} />,
        value: formatNumber(metrics.projects.total),
        unit: t('unit_projects'),
        details: [
          { label: t('card_projects_grants'), value: formatNumber(metrics.projects.grants) },
          { label: t('card_projects_programs'), value: formatNumber(metrics.projects.programs) },
          { label: t('card_projects_contracts'), value: formatNumber(metrics.projects.contracts) },
          { label: t('card_projects_commercialization'), value: formatNumber(metrics.projects.commercialization) },
          {
            label: t('card_projects_trl_high'),
            value: metrics.projects.avgDuration.toFixed(1),
          },
        ],
      },
      {
        title: t('card_publications_title'),
        icon: <FileText size={40} />,
        value: formatNumber(metrics.publications.total),
        unit: t('unit_publications'),
        details: [
          { label: t('card_publications_scopus'), value: formatNumber(metrics.publications.journals) },
          { label: t('card_publications_patents'), value: formatNumber(metrics.publications.conferences) },
          { label: t('card_publications_acts'), value: formatNumber(metrics.publications.books) },
          { label: t('card_publications_monographs'), value: formatNumber(metrics.publications.other) },
          { label: t('card_publications_security_docs'), value: formatNumber(metrics.publications.other) },
          { label: t('card_publications_implementations'), value: formatNumber(metrics.publications.other) },
        ],
      },
      {
        title: t('card_employees_title'),
        icon: <Users2 size={40} />,
        value: formatNumber(metrics.people.total),
        unit: t('unit_people'),
        details: [
          { label: t('card_employees_doctors'), value: formatNumber(metrics.people.docents) },
          { label: t('card_employees_candidates'), value: formatNumber(metrics.people.professors) },
          { label: t('card_employees_masters'), value: formatNumber(metrics.people.associateProfessors) },
          { label: t('card_employees_h_index_high'), value: metrics.people.avgAge.toFixed(1) },
        ],
      },
      {
        title: t('card_finances_title'),
        icon: <DollarSign size={40} />,
        value: formatNumber(metrics.finances.total, { maximumFractionDigits: 1 }),
        unit: t('unit_mlrd_tg'),
        details: [
          {
            label: t('card_finances_total_current_year'),
            value: `${formatNumber(metrics.finances.lastYear, { maximumFractionDigits: 1 })} ${t('unit_mlrd_tg')}`,
          },
          {
            label: t('card_finances_avg_per_project'),
            value: `${formatNumber(metrics.finances.avgExpense, { maximumFractionDigits: 0 })} ${t('unit_thousand_tg')}`,
          },
          {
            label: t('card_finances_cofinancing_amount'),
            value: `${formatNumber(metrics.finances.budgetUsage, { maximumFractionDigits: 1 })}%`,
          },
          {
            label: t('card_finances_regional_programs'),
            value: formatNumber(metrics.finances.regionalPrograms),
          },
        ],
      },
    ],
    [metrics, t],
  );

  const handleRegionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRegionId(event.target.value as RegionId);
  };

  const handleYearChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedYear(Number(event.target.value));
  };

  const handlePriorityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPriority(event.target.value);
  };

  const handleOrganizationChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedOrganization(event.target.value);
  };

  const mapHighlights = [
    {
      label: t('projects_page_title'),
      value: formatNumber(metrics.projects.total),
      path: '/projects',
    },
    {
      label: t('publications_page_title'),
      value: formatNumber(metrics.publications.total),
      path: '/publications',
    },
    {
      label: t('employees_page_title'),
      value: formatNumber(metrics.people.total),
      path: '/employees',
    },
    {
      label: t('finances_page_title'),
      value: `${formatNumber(metrics.finances.total, { maximumFractionDigits: 1 })} ${t('unit_mlrd_tg')}`,
      path: '/finances',
    },
  ];

  return (
    <div className="home-page" data-testid="home-page">
      <section className="map-section">
        <div className="map-container">
          <section className="home-filter-bar" aria-label={t('map_overview_title')}>
            <div className="home-filter-group">
              <label htmlFor="home-filter-region">{t('map_overview_title')}</label>
              <select
                id="home-filter-region"
                className="home-filter-select"
                value={selectedRegionId}
                onChange={handleRegionChange}
              >
                <option value="national">{t('republic_kazakhstan')}</option>
                {regionsData.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="home-filter-group">
              <label htmlFor="home-filter-direction">{t('filter_select_direction')}</label>
              <select
                id="home-filter-direction"
                className="home-filter-select"
                value={selectedPriority}
                onChange={handlePriorityChange}
                disabled={isFiltersLoading}
              >
                <option value="">{t('filter_select_direction')}</option>
                {dashboardFilters.priority.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="home-filter-group">
              <label htmlFor="home-filter-organization">{t('filter_select_organization')}</label>
              <select
                id="home-filter-organization"
                className="home-filter-select"
                value={selectedOrganization}
                onChange={handleOrganizationChange}
                disabled={isFiltersLoading}
              >
                <option value="">{t('filter_select_organization')}</option>
                {dashboardFilters.applicant.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="home-filter-group">
              <label htmlFor="home-filter-priority" title={t('filter_select_priority')}>
                {t('filter_select_priority')}
              </label>
              <select
                id="home-filter-priority"
                className="home-filter-select"
                value={selectedPriority}
                onChange={handlePriorityChange}
                disabled={isFiltersLoading}
              >
                <option value="">{t('filter_all_priorities')}</option>
                {dashboardFilters.priority.map((option) => (
                  <option key={`priority-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="home-filter-group">
              <label htmlFor="home-filter-year">{t('filter_year_range')}</label>
              <select id="home-filter-year" className="home-filter-select" value={selectedYear} onChange={handleYearChange}>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <div className="map-panel">
            <KazakhstanMap selectedRegionId={selectedRegionId} onRegionSelect={handleRegionSelect} />

            <aside className="map-info">
              <span className="map-tag">
                {selectedRegion ? t('map_tag_selected') : t('map_tag_national')}
              </span>
              <h2>{selectedRegion?.name ?? t('republic_kazakhstan')}</h2>
              <p className="map-info-subtitle">
                {t('map_subtitle')}
              </p>
              {dashboardError && <p className="map-info-subtitle">{dashboardError}</p>}

              <div className="map-info-grid">
                {mapHighlights.map((item) => (
                  <Link key={item.label} to={item.path} className="map-info-item">
                    <span className="map-info-item-label">{item.label}</span>
                    <span className="map-info-item-value">{item.value}</span>
                  </Link>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="stats-section" aria-label={t('stats_section_title')}>
        {isDashboardLoading ? (
          <PageLoader />
        ) : (
        <div className="stats-grid">
          {summaryCards.map((stat) => (
            <article key={stat.title} className="stat-card">
              <div className="stat-icon" aria-hidden="true">
                {stat.icon}
              </div>
              <div className="stat-content">
                <h3>{stat.title}</h3>
                <div className="stat-main">
                  <span className="stat-value">{stat.value}</span>
                  <span className="stat-unit">{stat.unit}</span>
                </div>
                <div className="stat-items">
                  {stat.details.map((detail) => (
                    <div key={detail.label} className="stat-item">
                      <span className="stat-item-value">{detail.value}</span>
                      <span className="stat-item-label">{detail.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
        )}
      </section>
    </div>
  );
};

export default HomePage;