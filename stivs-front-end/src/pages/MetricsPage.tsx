import React, { useMemo, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import type {
  ActiveElement,
  ChartDataset,
  ChartOptions,
  ChartType,
  Plugin,
  ScriptableContext,
  ScatterDataPoint,
} from 'chart.js';
import { SlidersHorizontal, Sparkles, Map as MapIcon, RefreshCcw, CircleHelp } from 'lucide-react';
import KazakhstanMap from '../components/Home/KazakhstanMap';
import { useRegionContext } from '../context/RegionContext';
import type { RegionId } from '../context/RegionContext';
import {
  scienceMetrics,
  scienceMetricsById,
  scienceIndexBounds,
  scienceIndexAverages,
  getRegionScienceMetric,
  nationalScienceSnapshot,
  type RegionScienceProfile,
} from '../data/scienceMetrics';
import { formatNumber } from '../utils/metrics';
import './MetricsPage.css';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend);

type XAxisMetric = 'perOrg' | 'perAuthor';
type YAxisMetric = 'citations' | 'citedShare';
type MapMetricKey = 'citations' | 'perOrg';

interface ScatterPoint extends ScatterDataPoint {
  x: number;
  y: number;
  regionId: string;
  regionName: string;
  publications: number;
  citationsPerArticle: number;
  medianHIndex: number;
  collaborationShare: number;
  concentrationTop10: number;
  activeAuthors: number;
  size: number;
  type: RegionScienceProfile['type'];
}

interface QuadrantGuideOptions {
  vertical?: number;
  horizontal?: number;
  labels?: {
    topRight: string;
    topLeft: string;
    bottomRight: string;
    bottomLeft: string;
  };
}

declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType> {
    quadrantGuide?: TType extends 'scatter' ? QuadrantGuideOptions : never;
  }
}

const quadrantGuidePlugin: Plugin<'scatter'> = {
  id: 'quadrantGuide',
  afterDraw: (chart) => {
    const guide = chart.options.plugins?.quadrantGuide as QuadrantGuideOptions | undefined;
    if (!guide || guide.vertical === undefined || guide.horizontal === undefined) {
      return;
    }

    const xScale = chart.scales.x;
    const yScale = chart.scales.y;
    const x = xScale.getPixelForValue(guide.vertical);
    const y = yScale.getPixelForValue(guide.horizontal);
    const { left, right, top, bottom } = chart.chartArea;
    const ctx = chart.ctx;

    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.restore();

    if (guide.labels) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.font = '600 12px Inter, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const centerHorizontal = (left + right) / 2;
      const centerVertical = (top + bottom) / 2;
      ctx.fillText(guide.labels.topLeft, (left + x) / 2, top + 18);
      ctx.fillText(guide.labels.topRight, (x + right) / 2, top + 18);
      ctx.fillText(guide.labels.bottomLeft, (left + x) / 2, bottom - 18);
      ctx.fillText(guide.labels.bottomRight, (x + right) / 2, bottom - 18);
      ctx.restore();

      ctx.save();
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.fillRect(centerHorizontal - 1, top, 2, bottom - top);
      ctx.fillRect(left, centerVertical - 1, right - left, 2);
      ctx.restore();
    }
  },
};

ChartJS.register(quadrantGuidePlugin);

const TYPE_COLORS: Record<RegionScienceProfile['type'], string> = {
  region: '#1d4ed8',
  city: '#f97316',
};

const clampValue = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const computeMedian = (values: number[]): number => {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
};

const projectBubbleRadius = (activeAuthors: number): number => {
  const base = Math.sqrt(activeAuthors) * 0.6;
  return clampValue(base, 6, 22);
};

const getMapMetricValue = (region: RegionScienceProfile, metric: MapMetricKey): number => {
  switch (metric) {
    case 'perOrg':
      return region.publicationsPerOrg;
    case 'citations':
    default:
      return region.citationsPerArticle;
  }
};

const getChoroplethColor = (value: number, min: number, max: number): string => {
  const range = max - min || 1;
  const ratio = clampValue((value - min) / range, 0, 1);
  const hue = 130;
  const saturation = 45 + ratio * 30;
  const lightness = 92 - ratio * 50;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

const formatPercent = (value: number, digits = 0): string => {
  return `${(value * 100).toFixed(digits)}%`;
};

const normalizeIndex = (value: number, bounds: { min: number; max: number }): number => {
  const { min, max } = bounds;
  const range = max - min || 1;
  return ((value - min) / range) * 100;
};

const MetricsPage: React.FC = () => {
  const { t } = useTranslation();
  const { selectedRegionId, setSelectedRegionId } = useRegionContext();

  const [xMetric, setXMetric] = useState<XAxisMetric>('perOrg');
  const [yMetric, setYMetric] = useState<YAxisMetric>('citations');
  const [mapMetric, setMapMetric] = useState<MapMetricKey>('citations');
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const scatterRef = useRef<ChartJS<'scatter', ScatterPoint[], unknown> | null>(null);

  const { pointsByType, xMedian, yMedian } = useMemo(() => {
    const grouped: Record<RegionScienceProfile['type'], ScatterPoint[]> = {
      region: [],
      city: [],
    };
    const xValues: number[] = [];
    const yValues: number[] = [];

    scienceMetrics.forEach((metric) => {
      const xValue = xMetric === 'perOrg' ? metric.publicationsPerOrg : metric.publicationsPerAuthor;
      const yValue = yMetric === 'citations' ? metric.citationsPerArticle : metric.citedArticlesShare * 100;

      const point: ScatterPoint = {
        x: Number(xValue.toFixed(2)),
        y: Number(yValue.toFixed(2)),
        regionId: metric.id,
        regionName: metric.name,
        publications: metric.publications,
        citationsPerArticle: metric.citationsPerArticle,
        medianHIndex: metric.medianHIndex,
        collaborationShare: metric.collaborationShare,
        concentrationTop10: metric.concentrationTop10,
        activeAuthors: metric.activeAuthors,
        size: projectBubbleRadius(metric.activeAuthors),
        type: metric.type,
      };

      grouped[metric.type].push(point);
      xValues.push(point.x);
      yValues.push(point.y);
    });

    return {
      pointsByType: grouped,
      xMedian: computeMedian(xValues),
      yMedian: computeMedian(yValues),
    };
  }, [xMetric, yMetric]);

  const scatterDatasets = useMemo<ChartDataset<'scatter', ScatterPoint[]>[]>(() => {
    const datasets = (Object.keys(pointsByType) as Array<RegionScienceProfile['type']>).map((type) => ({
      label:
        type === 'city'
          ? t('metrics_legend_cities')
          : t('metrics_legend_regions'),
      data: pointsByType[type],
      pointBackgroundColor: (context: ScriptableContext<'line'>) => {
        const raw = context.raw as ScatterPoint;
        const isSelected = raw?.regionId === selectedRegionId;
        if (isSelected) {
          return '#0f172a';
        }
        return TYPE_COLORS[type];
      },
      pointBorderColor: 'rgba(255,255,255,0.9)',
      pointBorderWidth: 2,
      pointRadius: (context: ScriptableContext<'line'>) => (context.raw as ScatterPoint)?.size ?? 8,
      pointHoverRadius: (context: ScriptableContext<'line'>) => ((context.raw as ScatterPoint)?.size ?? 8) + 2,
    }));

    datasets.push({
      label: t('metrics_country_median_label'),
      data: [
        {
          x: Number(xMedian.toFixed(2)),
          y: Number(yMedian.toFixed(2)),
          regionId: 'national-median',
          regionName: t('metrics_country_median_label'),
          publications: nationalScienceSnapshot.publications,
          citationsPerArticle: nationalScienceSnapshot.citationsPerArticle,
          medianHIndex: nationalScienceSnapshot.medianHIndex,
          collaborationShare: nationalScienceSnapshot.collaborationShare,
          concentrationTop10: 0,
          activeAuthors: nationalScienceSnapshot.activeAuthors,
          size: 8,
          type: 'region',
        },
      ],
      pointBackgroundColor: () => '#0f172a',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointRadius: () => 8,
      pointHoverRadius: () => 10,
    });

    return datasets;
  }, [pointsByType, selectedRegionId, t, xMedian, yMedian]);

  const scatterData = useMemo(() => ({ datasets: scatterDatasets }), [scatterDatasets]);

  const scatterOptions = useMemo<ChartOptions<'scatter'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            color: '#0f172a',
            font: { weight: 600 },
          },
        },
        tooltip: {
          backgroundColor: '#0f172a',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          padding: 14,
          titleFont: { weight: 600 },
        callbacks: {
          title: (items) => {
            const raw = items[0]?.raw as ScatterPoint | undefined;
            return raw?.regionName ?? '';
          },
          label: (context) => {
            const raw = context.raw as ScatterPoint;
            if (!raw) {
              return '';
            }
            if (raw.regionId === 'national-median') {
              return t('metrics_country_median_label');
            }
            return '';
          },
          afterLabel: (context) => {
            const raw = context.raw as ScatterPoint;
            if (!raw) {
              return [];
            }
            if (raw.regionId === 'national-median') {
              return [
                `${t('metrics_tooltip_median_x')}: ${raw.x.toFixed(1)}`,
                `${t('metrics_tooltip_median_y')}: ${raw.y.toFixed(1)}`,
              ];
            }
            return [
              `${t('metrics_tooltip_publications')}: ${formatNumber(raw.publications)}`,
              `${t('metrics_tooltip_citations')}: ${raw.citationsPerArticle.toFixed(1)}`,
              `${t('metrics_tooltip_hindex')}: ${raw.medianHIndex.toFixed(1)}`,
              `${t('metrics_tooltip_collaboration')}: ${formatPercent(raw.collaborationShare, 0)}`,
              `${t('metrics_tooltip_concentration')}: ${formatPercent(raw.concentrationTop10, 0)}`,
            ];
          },
        },
      },
      quadrantGuide: {
        vertical: Number(xMedian.toFixed(2)),
        horizontal: Number(yMedian.toFixed(2)),
        labels: {
          topRight: t('metrics_quadrant_leaders'),
          topLeft: t('metrics_quadrant_growth'),
          bottomRight: t('metrics_quadrant_risk'),
          bottomLeft: t('metrics_quadrant_laggards'),
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: t('metrics_axis_activity_label'),
          color: '#0f172a',
          font: { weight: 600 },
        },
        grid: { color: 'rgba(148, 163, 184, 0.2)' },
        ticks: {
          callback: (value) => Number(value).toFixed(1),
          color: '#475569',
        },
      },
      y: {
        title: {
          display: true,
          text:
            yMetric === 'citations'
              ? t('metrics_axis_influence_label')
              : t('metrics_axis_influence_label_share'),
          color: '#0f172a',
          font: { weight: 600 },
        },
        grid: { color: 'rgba(148, 163, 184, 0.15)' },
        ticks: {
          callback: (value) =>
            yMetric === 'citations'
              ? Number(value).toFixed(1)
              : `${Number(value).toFixed(0)}%`,
          color: '#475569',
        },
      },
    },
  }), [t, xMedian, yMedian, yMetric]);

  const handleScatterClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const chart = scatterRef.current;
      if (!chart) {
        return;
      }
      const elements = chart.getElementsAtEventForMode(
        event.nativeEvent,
        'nearest',
        { intersect: true },
        false,
      ) as ActiveElement[];
      if (!elements?.length) {
        return;
      }
      const { datasetIndex, index } = elements[0];
      const dataset = chart.data.datasets?.[datasetIndex] as ChartDataset<'scatter', ScatterPoint[]> | undefined;
      const point = dataset?.data?.[index];
      if (point) {
        const nextRegionId = selectedRegionId === point.regionId ? 'national' : point.regionId;
        setSelectedRegionId(nextRegionId as RegionId);
      }
    },
    [selectedRegionId, setSelectedRegionId],
  );

  const mapMetricConfig = useMemo<Record<MapMetricKey, { label: string; short: string; format: (value: number) => string }>>(
    () => ({
      citations: {
        label: t('metrics_map_metric_citations'),
        short: t('metrics_map_metric_citations_short'),
        format: (value: number) => `${value.toFixed(1)}`,
      },
      perOrg: {
        label: t('metrics_map_metric_per_org'),
        short: t('metrics_map_metric_per_org_short'),
        format: (value: number) => `${value.toFixed(1)}`,
      },
    }),
    [t],
  );

  const mapStats = useMemo(() => {
    const values = scienceMetrics.map((region) => getMapMetricValue(region, mapMetric));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const median = computeMedian(values);
    return { min, max, median };
  }, [mapMetric]);

  const mapFillResolver = useCallback(
    (regionId: string) => {
      const region = scienceMetricsById.get(regionId);
      if (!region) {
        return undefined;
      }
      const value = getMapMetricValue(region, mapMetric);
      return getChoroplethColor(value, mapStats.min, mapStats.max);
    },
    [mapMetric, mapStats.max, mapStats.min],
  );

  const countryAverageSnapshot = useMemo(() => {
    const count = scienceMetrics.length || 1;
    const totals = scienceMetrics.reduce(
      (acc, region) => {
        acc.publications += region.publications;
        acc.citationsPerArticle += region.citationsPerArticle;
        acc.activeAuthors += region.activeAuthors;
        acc.medianHIndex += region.medianHIndex;
        acc.collaborationShare += region.collaborationShare;
        return acc;
      },
      {
        publications: 0,
        citationsPerArticle: 0,
        activeAuthors: 0,
        medianHIndex: 0,
        collaborationShare: 0,
      },
    );

    return {
      publications: Math.round(totals.publications / count),
      citationsPerArticle: totals.citationsPerArticle / count,
      activeAuthors: Math.round(totals.activeAuthors / count),
      medianHIndex: totals.medianHIndex / count,
      collaborationShare: totals.collaborationShare / count,
    };
  }, []);

  const selectedProfile = useMemo(() => {
    if (selectedRegionId === 'national') {
      return null;
    }
    return getRegionScienceMetric(selectedRegionId);
  }, [selectedRegionId]);

  const kpiScopeLabel = selectedProfile?.name ?? t('metrics_kpi_scope_country');
  const kpiSource = selectedProfile ?? countryAverageSnapshot;

  const kpiCards = useMemo(
    () => [
      {
        key: 'publications',
        label: t('metrics_card_publications'),
        value: formatNumber(kpiSource.publications),
        badge: '📄',
      },
      {
        key: 'citations',
        label: t('metrics_card_citations'),
        value: kpiSource.citationsPerArticle.toFixed(1),
        badge: '📈',
      },
      {
        key: 'authors',
        label: t('metrics_card_active_authors'),
        value: formatNumber(kpiSource.activeAuthors),
        badge: '👥',
      },
      {
        key: 'hindex',
        label: t('metrics_card_hindex'),
        value: kpiSource.medianHIndex.toFixed(1),
        badge: '🧠',
      },
      {
        key: 'collab',
        label: t('metrics_card_collaboration'),
        value: formatPercent(kpiSource.collaborationShare, 0),
        badge: '🤝',
      },
    ],
    [kpiSource, t],
  );

  const indexSource = selectedProfile
    ? {
        activity: selectedProfile.activityIndex,
        influence: selectedProfile.influenceIndex,
        stability: selectedProfile.stabilityIndex,
      }
    : scienceIndexAverages;

  const indexCards = useMemo(
    () => [
      {
        key: 'activity',
        label: t('metrics_index_activity'),
        description: t('metrics_index_activity_description'),
        value: indexSource.activity,
        bounds: scienceIndexBounds.activity,
      },
      {
        key: 'influence',
        label: t('metrics_index_influence'),
        description: t('metrics_index_influence_description'),
        value: indexSource.influence,
        bounds: scienceIndexBounds.influence,
      },
      {
        key: 'stability',
        label: t('metrics_index_stability'),
        description: t('metrics_index_stability_description'),
        value: indexSource.stability,
        bounds: scienceIndexBounds.stability,
      },
    ],
    [indexSource.activity, indexSource.influence, indexSource.stability, t],
  );

  const handleResetSelection = useCallback(() => {
    setSelectedRegionId('national');
  }, [setSelectedRegionId]);

  const axisXOptions: Array<{ value: XAxisMetric; label: string }> = useMemo(
    () => [
      { value: 'perOrg', label: t('metrics_axis_activity_org') },
      { value: 'perAuthor', label: t('metrics_axis_activity_author') },
    ],
    [t],
  );

  const axisYOptions: Array<{ value: YAxisMetric; label: string }> = useMemo(
    () => [
      { value: 'citations', label: t('metrics_axis_influence_label') },
      { value: 'citedShare', label: t('metrics_axis_influence_label_share') },
    ],
    [t],
  );

  const mapOptions: Array<{ value: MapMetricKey; label: string; title: string }> = useMemo(
    () => [
      {
        value: 'citations',
        label: mapMetricConfig.citations.label,
        title: mapMetricConfig.citations.label,
      },
      {
        value: 'perOrg',
        label: mapMetricConfig.perOrg.label,
        title: mapMetricConfig.perOrg.label,
      },
    ],
    [mapMetricConfig],
  );

  return (
    <div className="metrics-page">
      <section className="metrics-header">
        <div className="metrics-header-text">
          <h1>{t('metrics_page_title')}</h1>
          <p>{t('metrics_page_description')}</p>
        </div>
        <div className="metrics-header-controls">
          <button
            type="button"
            className="metrics-info-button"
            onClick={() => setIsAboutOpen((prev) => !prev)}
            aria-expanded={isAboutOpen}
            aria-controls="metrics-about-panel"
          >
            <CircleHelp size={16} />
            <span>{t('metrics_about_button')}</span>
          </button>
          <div className="metrics-header-icon" aria-hidden="true">
            <Sparkles size={28} />
          </div>
          {selectedRegionId !== 'national' && (
            <button type="button" className="metrics-reset-button" onClick={handleResetSelection}>
              <RefreshCcw size={16} />
              <span>{t('metrics_reset_selection')}</span>
            </button>
          )}
        </div>
      </section>

      {isAboutOpen && (
        <section className="metrics-about-panel" id="metrics-about-panel">
          <h2>{t('metrics_about_title')}</h2>
          <p>{t('metrics_about_intro')}</p>
          <ul>
            <li>{t('metrics_about_item_publications')}</li>
            <li>{t('metrics_about_item_citations')}</li>
            <li>{t('metrics_about_item_authors')}</li>
            <li>{t('metrics_about_item_collaboration')}</li>
            <li>{t('metrics_about_item_topics')}</li>
          </ul>
          <p>{t('metrics_about_chart')}</p>
          <p>{t('metrics_about_auto')}</p>
          <p className="metrics-about-warning">{t('metrics_about_warning')}</p>
        </section>
      )}

      <div className="metrics-module-banner" role="status" aria-live="polite">
        модуль находится на стадии интеграции и тестирования
      </div>

      <div className="metrics-main">
        <section className="metrics-scatter-card">
          <header className="metrics-card-header">
            <div>
              <p className="metrics-card-kicker">{t('metrics_scatter_subtitle')}</p>
              <h2>{t('metrics_scatter_title')}</h2>
            </div>
            <div className="metrics-toggle-stack">
              <div className="metrics-toggle-group">
                <SlidersHorizontal size={16} />
                {axisXOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={option.value === xMetric ? 'toggle-chip active' : 'toggle-chip'}
                    onClick={() => setXMetric(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="metrics-toggle-group">
                <SlidersHorizontal size={16} />
                {axisYOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={option.value === yMetric ? 'toggle-chip active' : 'toggle-chip'}
                    onClick={() => setYMetric(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </header>
          <div className="metrics-scatter-chart">
            <Scatter
              ref={scatterRef}
              data={scatterData}
              options={scatterOptions}
              onClick={handleScatterClick}
            />
          </div>
          <div className="metrics-scatter-legend">
            <span>{t('metrics_scatter_size_hint')}</span>
            <span>{t('metrics_scatter_color_hint')}</span>
          </div>
        </section>

        <aside className="metrics-map-card">
          <div className="metrics-map-header">
            <div>
              <h3>{t('metrics_map_title')}</h3>
              <p className="metrics-map-current-metric" title={mapMetricConfig[mapMetric].label}>
                {mapMetricConfig[mapMetric].label}
              </p>
              <p className="metrics-map-hint">{t('metrics_map_hint')}</p>
            </div>
            <MapIcon size={28} />
          </div>
          <div className="metrics-map-toggles">
            {mapOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={option.value === mapMetric ? 'toggle-chip active' : 'toggle-chip'}
                onClick={() => setMapMetric(option.value)}
                title={option.title}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="metrics-map-frame">
            <KazakhstanMap
              selectedRegionId={selectedRegionId}
              onRegionSelect={(regionId) => {
                const nextRegionId = selectedRegionId === regionId ? 'national' : regionId;
                setSelectedRegionId(nextRegionId as RegionId);
              }}
              getRegionFill={mapFillResolver}
              useShortLabels={false}
              showLabels={false}
            />
          </div>
          <div className="metrics-map-legend">
            <div>
              <span>{t('metrics_map_legend_min')}</span>
              <strong>{mapMetricConfig[mapMetric].format(mapStats.min)}</strong>
            </div>
            <div>
              <span>{t('metrics_map_legend_median')}</span>
              <strong>{mapMetricConfig[mapMetric].format(mapStats.median)}</strong>
            </div>
            <div>
              <span>{t('metrics_map_legend_max')}</span>
              <strong>{mapMetricConfig[mapMetric].format(mapStats.max)}</strong>
            </div>
          </div>
        </aside>
      </div>

      <div className="metrics-bottom">
        <section className="metrics-kpi-panel">
          <header className="metrics-card-header">
            <div>
              <p className="metrics-card-kicker">{kpiScopeLabel}</p>
              <h3>{t('metrics_kpi_title')}</h3>
            </div>
          </header>
          <div className="metrics-kpi-grid">
            {kpiCards.map((card) => (
              <article key={card.key} className="metrics-kpi-card">
                <span className="metrics-kpi-badge" aria-hidden="true">
                  {card.badge}
                </span>
                <div>
                  <p>{card.label}</p>
                  <strong>{card.value}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="metrics-index-panel">
          <header className="metrics-card-header">
            <div>
              <p className="metrics-card-kicker">{t('metrics_index_hint')}</p>
              <h3>{t('metrics_index_title')}</h3>
            </div>
          </header>
          <div className="metrics-index-list">
            {indexCards.map((indexCard) => (
              <article key={indexCard.key} className="metrics-index-card">
                <div className="metrics-index-labels">
                  <div className="metrics-index-label-main">
                    <span>{indexCard.label}</span>
                    <div className="metrics-inline-help">
                      <button
                        type="button"
                        className="metrics-inline-help-button"
                        aria-label={t('metrics_index_help_aria', { label: indexCard.label })}
                      >
                        <CircleHelp size={14} />
                      </button>
                      <div className="metrics-inline-help-tooltip" role="tooltip">
                        <p>{indexCard.description}</p>
                      </div>
                    </div>
                  </div>
                  <strong>{indexCard.value.toFixed(2)}</strong>
                </div>
                <div className="metrics-index-bar">
                  <div
                    className="metrics-index-bar-fill"
                    style={{ width: `${normalizeIndex(indexCard.value, indexCard.bounds).toFixed(0)}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default MetricsPage;
