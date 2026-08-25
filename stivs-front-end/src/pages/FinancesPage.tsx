import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRegionContext } from '../context/RegionContext';
import type { RegionId } from '../context/RegionContext';
import KazakhstanMap from '../components/Home/KazakhstanMap';
import { calculateNationalMetrics, formatNumber } from '../utils/metrics';
import { DollarSign, TrendingUp } from 'lucide-react';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  Tooltip,
  type ChartOptions,
  LineController,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import './FinancesPage.css';
import { useTranslation } from 'react-i18next';
import { useFinanceSummary } from '../hooks/useFinanceSummary';
import { financesApi } from '../api/services';
import type { FinanceFilterMeta, FinanceFilterOptions, FinanceSummary } from '../api/types';
import PageLoader from '../components/PageLoader/PageLoader';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  LineController,
);

type FinancingType = string;
type CofinancingType = 'all' | 'contract' | 'actual';
type ExpenseCategory = 'salary' | 'travel' | 'support' | 'materials' | 'rent' | 'protocol';
type PriorityDirection = 'all' | 'digital' | 'education' | 'biotech' | 'energy';
type CompetitionName = 'all' | 'innovation' | 'grant2025' | 'pilot';
type ApplicantType = 'all' | 'universities' | 'companies' | 'research';
type CustomerType = 'all' | 'ministry' | 'state-companies' | 'private';
type ProjectStatus = 'all' | 'active' | 'completed' | 'pipeline';

interface FilterState {
  irn: string;
  startYear: number;
  endYear: number;
  financingType: FinancingType;
  cofinancing: CofinancingType;
  expense: ExpenseCategory;
  priority: PriorityDirection;
  competition: CompetitionName;
  applicant: ApplicantType;
  customer: CustomerType;
  status: ProjectStatus;
}

interface ChartFilterState {
  cofinancing: CofinancingType[];
  expenses: ExpenseCategory[];
  financingTypes: FinancingType[];
}

// Helper function to generate options with translations
const getFinancesOptions = (t: (key: string) => string) => ({
  irn: [
    { value: 'all', label: t('finances_option_all_irn') },
    { value: 'irn-001', label: 'IRN 001' },
    { value: 'irn-057', label: 'IRN 057' },
    { value: 'irn-112', label: 'IRN 112' },
    { value: 'irn-204', label: 'IRN 204' },
  ],
  financingType: [
    { value: 'all', label: t('finances_option_all_financing_types') },
    { value: 'gf', label: t('finances_financing_gf') },
    { value: 'pcf', label: t('finances_financing_pcf') },
    { value: 'commercial', label: t('finances_financing_commercial') },
  ],
  cofinancing: [
    { value: 'all', label: t('finances_option_all_cofinancing') },
    { value: 'contract', label: t('finances_cofinancing_contract') },
    { value: 'actual', label: t('finances_cofinancing_actual') },
  ],
  expense: [
    { value: 'salary', label: t('finances_expense_salary') },
    { value: 'travel', label: t('finances_expense_travel') },
    { value: 'support', label: t('finances_expense_support') },
    { value: 'materials', label: t('finances_expense_materials') },
    { value: 'rent', label: t('finances_expense_rent') },
    { value: 'protocol', label: t('finances_expense_protocol') },
  ],
  priority: [
    { value: 'all', label: t('finances_option_all_priorities') },
    { value: 'digital', label: t('finances_priority_digital') },
    { value: 'education', label: t('finances_priority_education') },
    { value: 'biotech', label: t('finances_priority_biotech') },
    { value: 'energy', label: t('finances_priority_energy') },
  ],
  competition: [
    { value: 'all', label: t('finances_option_all_competitions') },
    { value: 'innovation', label: t('finances_competition_innovation') },
    { value: 'grant2025', label: t('finances_competition_grant2025') },
    { value: 'pilot', label: t('finances_competition_pilot') },
  ],
  applicant: [
    { value: 'all', label: t('finances_option_all_applicants') },
    { value: 'universities', label: t('finances_applicant_universities') },
    { value: 'companies', label: t('finances_applicant_companies') },
    { value: 'research', label: t('finances_applicant_research') },
  ],
  customer: [
    { value: 'all', label: t('finances_option_all_customers') },
    { value: 'ministry', label: t('finances_customer_ministry') },
    { value: 'state-companies', label: t('finances_customer_state_companies') },
    { value: 'private', label: t('finances_customer_private') },
  ],
  status: [
    { value: 'all', label: t('finances_option_all_statuses') },
    { value: 'active', label: t('finances_status_active') },
    { value: 'completed', label: t('finances_status_completed') },
    { value: 'pipeline', label: t('finances_status_pipeline') },
  ],
});

const COFINANCING_DEFAULTS: CofinancingType[] = ['contract', 'actual'];

const EXPENSE_DEFAULTS: ExpenseCategory[] = ['salary', 'travel', 'support', 'materials', 'rent', 'protocol'];

const FINANCING_TYPE_DEFAULTS: FinancingType[] = ['gf', 'pcf', 'commercial'];

const FINANCES_PERIOD_RANGE = { min: 2020, max: 2040 } as const;

const DEFAULT_CHART_FILTERS: ChartFilterState = {
  cofinancing: [...COFINANCING_DEFAULTS],
  expenses: [...EXPENSE_DEFAULTS],
  financingTypes: [...FINANCING_TYPE_DEFAULTS],
};

const COFINANCING_YEAR_LABELS = ['2020', '2021', '2022', '2023', '2024'];

const EXPENSE_ACTIVE_COLORS = ['#2563eb', '#0ea5e9', '#14b8a6', '#f97316', '#f59e0b', '#a855f7'];

const FINANCING_TYPE_COLORS = ['#1d4ed8', '#7c3aed', '#0ea5e9'];

const clampValue = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const applyRealFinances = (
  baseFinances: ReturnType<typeof calculateNationalMetrics>['finances'],
  summary: FinanceSummary | null,
) => {
  if (!summary) {
    return baseFinances;
  }

  const totalBudgetBln = Number((summary.totalBudget / 1_000_000_000).toFixed(2));
  const totalSpentBln = Number((summary.totalSpent / 1_000_000_000).toFixed(2));
  const budgetUsage =
    totalBudgetBln > 0 ? Number(((totalSpentBln / totalBudgetBln) * 100).toFixed(1)) : baseFinances.budgetUsage;

  return {
    ...baseFinances,
    total: totalBudgetBln,
    lastYear: totalSpentBln,
    avgExpense: totalSpentBln,
    budgetUsage,
  };
};

const FinancesPage: React.FC = () => {
  const { t } = useTranslation();
  const { selectedRegion, selectedRegionId, setSelectedRegionId, regions, isNational } =
    useRegionContext();

  const regionLabel = selectedRegion?.name ?? t('republic_kazakhstan');
  const currencyUnitShort = t('unit_bln_kzt_symbol');
  
  // Generate translated options
  const defaultFinancesOptions = useMemo(() => getFinancesOptions(t), [t]);

  const [apiFilterOptions, setApiFilterOptions] = useState<FinanceFilterOptions | null>(null);
  const [apiFilterMeta, setApiFilterMeta] = useState<FinanceFilterMeta | null>(null);
  
  const [filters, setFilters] = useState<FilterState>({
    irn: 'all',
    startYear: 2026,
    endYear: 2034,
    financingType: 'all',
    cofinancing: 'all',
    expense: 'salary',
    priority: 'all',
    competition: 'all',
    applicant: 'all',
    customer: 'all',
    status: 'all',
  });

  const resolveOptionLabel = useCallback(
    (value: string, options: Array<{ value: string; label: string }>) =>
      options.find((option) => option.value === value)?.label ?? value,
    [],
  );

  const toOptions = useCallback(
    (
      values: string[] | undefined,
      fallbackOptions: Array<{ value: string; label: string }>,
      includeAllOption = false,
    ) => {
      if (!values?.length) {
        return fallbackOptions;
      }

      const mapped = values.map((value) => ({
        value,
        label: resolveOptionLabel(value, fallbackOptions),
      }));

      if (includeAllOption && !mapped.some((option) => option.value === 'all')) {
        const fallbackAll = fallbackOptions.find((option) => option.value === 'all');
        if (fallbackAll) {
          return [fallbackAll, ...mapped];
        }
      }

      return mapped;
    },
    [resolveOptionLabel],
  );

  const financesOptions = useMemo(
    () => ({
      irn: toOptions(apiFilterOptions?.irn, defaultFinancesOptions.irn, true),
      financingType: toOptions(apiFilterOptions?.financingType, defaultFinancesOptions.financingType, true),
      cofinancing: toOptions(apiFilterOptions?.cofinancing, defaultFinancesOptions.cofinancing, true),
      expense: toOptions(apiFilterOptions?.expense, defaultFinancesOptions.expense),
      priority: toOptions(apiFilterOptions?.priority, defaultFinancesOptions.priority, true),
      competition: toOptions(apiFilterOptions?.competition, defaultFinancesOptions.competition, true),
      applicant: toOptions(apiFilterOptions?.applicant, defaultFinancesOptions.applicant, true),
      customer: toOptions(apiFilterOptions?.customer, defaultFinancesOptions.customer, true),
      status: toOptions(apiFilterOptions?.status, defaultFinancesOptions.status, true),
    }),
    [apiFilterOptions, defaultFinancesOptions, toOptions],
  );

  // Create aliases for backward compatibility with JSX
  const IRN_OPTIONS = financesOptions.irn;
  const FINANCING_TYPE_OPTIONS = financesOptions.financingType;
  const PRIORITY_OPTIONS = financesOptions.priority;
  const COMPETITION_OPTIONS = financesOptions.competition;
  const APPLICANT_OPTIONS = financesOptions.applicant;
  const CUSTOMER_OPTIONS = financesOptions.customer;
  const STATUS_OPTIONS = financesOptions.status;
  const COFINANCING_OPTIONS = financesOptions.cofinancing;
  const EXPENSE_OPTIONS = financesOptions.expense;

  const periodRange = useMemo(
    () => ({
      min: apiFilterOptions?.yearRange?.min ?? apiFilterMeta?.minYear ?? FINANCES_PERIOD_RANGE.min,
      max: apiFilterOptions?.yearRange?.max ?? apiFilterMeta?.maxYear ?? FINANCES_PERIOD_RANGE.max,
    }),
    [apiFilterMeta?.maxYear, apiFilterMeta?.minYear, apiFilterOptions?.yearRange?.max, apiFilterOptions?.yearRange?.min],
  );

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      startYear: clampValue(prev.startYear, periodRange.min, periodRange.max),
      endYear: clampValue(prev.endYear, periodRange.min, periodRange.max),
    }));
  }, [periodRange.max, periodRange.min]);

  useEffect(() => {
    const controller = new AbortController();

    const loadFilters = async () => {
      try {
        const payload = await financesApi.filters();
        if (!controller.signal.aborted) {
          setApiFilterOptions(payload);
        }
      } catch {
        if (!controller.signal.aborted) {
          setApiFilterOptions(null);
        }
      }
    };

    void loadFilters();

    return () => {
      controller.abort();
    };
  }, []);

  const toQueryValue = useCallback((value: string) => (value === 'all' ? undefined : value), []);

  const financeQuery = useMemo(
    () => ({
      startYear: filters.startYear,
      endYear: filters.endYear,
      region: selectedRegion?.name ?? 'all',
      irn: toQueryValue(filters.irn),
      financingType: toQueryValue(filters.financingType),
      cofinancing: toQueryValue(filters.cofinancing),
      expense: toQueryValue(filters.expense),
      priority: toQueryValue(filters.priority),
      competition: toQueryValue(filters.competition),
      applicant: toQueryValue(filters.applicant),
      customer: toQueryValue(filters.customer),
      status: toQueryValue(filters.status),
    }),
    [
      filters.applicant,
      filters.cofinancing,
      filters.competition,
      filters.customer,
      filters.endYear,
      filters.expense,
      filters.financingType,
      filters.irn,
      filters.priority,
      filters.startYear,
      filters.status,
      selectedRegion?.name,
      toQueryValue,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();

    const loadFiltersMeta = async () => {
      try {
        const payload = await financesApi.filtersMeta(financeQuery, controller.signal);
        if (!controller.signal.aborted) {
          setApiFilterMeta(payload);
        }
      } catch {
        if (!controller.signal.aborted) {
          setApiFilterMeta(null);
        }
      }
    };

    void loadFiltersMeta();

    return () => {
      controller.abort();
    };
  }, [financeQuery]);

  const { apiSummary, isSummaryLoading, summaryError } = useFinanceSummary(financeQuery);

  const nationalFinanceQuery = useMemo(() => ({ ...financeQuery, region: 'all' }), [financeQuery]);
  const { apiSummary: nationalApiSummary } = useFinanceSummary(nationalFinanceQuery);

  const nationalMetrics = useMemo(() => {
    const base = calculateNationalMetrics();
    return { ...base, finances: applyRealFinances(base.finances, nationalApiSummary) };
  }, [nationalApiSummary]);

  const metrics = useMemo(() => {
    const base = selectedRegion?.stats ?? calculateNationalMetrics();
    return { ...base, finances: applyRealFinances(base.finances, apiSummary) };
  }, [selectedRegion, apiSummary]);

  const [chartFilters, setChartFilters] = useState<ChartFilterState>({
    cofinancing: [],
    expenses: [],
    financingTypes: [],
  });
  const [isExpenseDrawerOpen, setExpenseDrawerOpen] = useState(false);
  const [isFinancingDrawerOpen, setFinancingDrawerOpen] = useState(false);

  const handleChartFilterAdd = useCallback(<K extends keyof ChartFilterState>(key: K, value: ChartFilterState[K][number]) => {
    setChartFilters((prev) => {
      const current = prev[key] as Array<ChartFilterState[K][number]>;
      if (current.includes(value)) {
        return prev;
      }

      return {
        ...prev,
        [key]: [...current, value],
      } as ChartFilterState;
    });
  }, []);

  const handleChartFilterRemove = useCallback(<K extends keyof ChartFilterState>(key: K, value: ChartFilterState[K][number]) => {
    setChartFilters((prev) => {
      const current = prev[key] as Array<ChartFilterState[K][number]>;
      const filtered = current.filter((item) => item !== value);
      return {
        ...prev,
        [key]: filtered,
      } as ChartFilterState;
    });
  }, []);

  const adjustedMetrics = metrics;

  const selectedCofinancingFilters = chartFilters.cofinancing;
  const activeCofinancingFilters = selectedCofinancingFilters.length
    ? selectedCofinancingFilters
    : DEFAULT_CHART_FILTERS.cofinancing;

  const cofinancingChartData = useMemo(() => {
    const base = Math.max(adjustedMetrics.finances.total * 0.18, 1);
    const contractMultipliers = [0.72, 0.78, 0.86, 0.93, 1];
    const contractData = COFINANCING_YEAR_LABELS.map((_, index) =>
      Number((base * contractMultipliers[index]).toFixed(1)),
    );

    const factModifier = filters.cofinancing === 'actual' ? 1.06 : 0.98;
    const actualData = contractData.map((value, index) => {
      const drift = 0.9 + index * 0.035;
      return Number((value * drift * factModifier).toFixed(1));
    });

    const datasets = activeCofinancingFilters.map((filter) =>
      filter === 'contract'
        ? {
            label: t('finances_cofinancing_contract'),
            data: contractData,
            backgroundColor: '#cbd5f5',
            borderRadius: 12,
            barThickness: 18,
            borderSkipped: false,
          }
        : {
            label: t('finances_cofinancing_actual'),
            data: actualData,
            backgroundColor: '#2563eb',
            borderRadius: 12,
            barThickness: 18,
            borderSkipped: false,
          },
    );

    return {
      labels: COFINANCING_YEAR_LABELS,
      datasets,
    };
  }, [activeCofinancingFilters, adjustedMetrics.finances.total, filters.cofinancing, t]);

  const remainingCofinancingOptions = useMemo(
    () => financesOptions.cofinancing.filter((option) => !selectedCofinancingFilters.includes(option.value as CofinancingType)),
    [selectedCofinancingFilters, financesOptions],
  );

  const cofinancingChartOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          align: 'start',
          labels: {
            color: '#0f172a',
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 18,
          },
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { weight: 600 },
          bodyFont: { weight: 500 },
          callbacks: {
            label: (context) => {
              const label = context.dataset.label ?? '';
              const value = context.raw as number;
              return `${label}: ${formatNumber(value, { maximumFractionDigits: 1 })} ${currencyUnitShort}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: '#475569',
            font: { weight: 600 },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(148, 163, 184, 0.2)', drawBorder: false },
          ticks: {
            color: '#475569',
            callback: (value) => `${Number(value).toFixed(0)} ${currencyUnitShort}`,
          },
        },
      },
    }),
    [currencyUnitShort],
  );

  const approvalChartData = useMemo(() => {
    const base = Math.max(adjustedMetrics.finances.lastYear * 0.8, 1);
    const effectivePeriod = Math.round((filters.startYear + filters.endYear) / 2);
    const progress = clampValue((effectivePeriod - 2020) / 20, 0.2, 1.2);
    const multipliers = [0.84, 0.9, 0.98, 1.06, 1.12 * progress];

    const timeline = COFINANCING_YEAR_LABELS.map((_, index) =>
      Number((base * (multipliers[index] ?? 1)).toFixed(1)),
    );

    return {
      labels: COFINANCING_YEAR_LABELS,
      datasets: [
        {
          label: t('finances_chart_approval'),
          data: timeline,
          backgroundColor: '#0ea5e9',
          hoverBackgroundColor: '#0369a1',
          borderRadius: 10,
          maxBarThickness: 32,
        },
      ],
    };
  }, [adjustedMetrics.finances.lastYear, filters.endYear, filters.startYear, t]);

  const approvalChartOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { weight: 600 },
          bodyFont: { weight: 500 },
          callbacks: {
            label: (context) => {
              const value = context.raw as number;
              return `${formatNumber(value, { maximumFractionDigits: 1 })} ${currencyUnitShort}`;
            },
          },
        },
      },
      scales: {
        x: {
          border: { display: false },
          grid: { display: false },
          ticks: { color: '#475569' },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(148, 163, 184, 0.2)', drawBorder: false },
          ticks: {
            color: '#94a3b8',
            callback: (value) => `${value} ${currencyUnitShort}`,
          },
        },
      },
    }),
    [currencyUnitShort],
  );

  const expenseBreakdown = useMemo(() => {
    const amountByCategory = new Map((apiSummary?.byCategory ?? []).map((item) => [item.category, item.amount]));
    const totalAmount = Array.from(amountByCategory.values()).reduce((acc, amount) => acc + amount, 0);

    return financesOptions.expense.map((option, index) => {
      const amount = amountByCategory.get(option.value) ?? 0;
      const share = totalAmount > 0 ? amount / totalAmount : 0;
      return {
        key: option.value as ExpenseCategory,
        label: option.label,
        value: Number((amount / 1_000_000_000).toFixed(1)),
        percentage: Number((share * 100).toFixed(1)),
        color: EXPENSE_ACTIVE_COLORS[index],
      };
    });
  }, [apiSummary, financesOptions]);

  const selectedExpenseFilters = chartFilters.expenses;
  const activeExpenseFilters = selectedExpenseFilters.length
    ? selectedExpenseFilters
    : DEFAULT_CHART_FILTERS.expenses;

  const filteredExpenses = useMemo(
    () => expenseBreakdown.filter((item: { key: ExpenseCategory; label: string; value: number; percentage: number; color: string }) => activeExpenseFilters.includes(item.key)),
    [expenseBreakdown, activeExpenseFilters],
  );

  const selectedExpenseTotal = useMemo(
    () => filteredExpenses.reduce((acc: number, item: { key: ExpenseCategory; label: string; value: number; percentage: number; color: string }) => acc + item.value, 0),
    [filteredExpenses],
  );

  const selectedExpenseLabel = useMemo(() => {
    if (!selectedExpenseFilters.length) {
      return t('filter_all_categories');
    }
    if (filteredExpenses.length === 1) {
      return filteredExpenses[0]?.label ?? '';
    }
    return t('finances_selected_count', { count: filteredExpenses.length });
  }, [filteredExpenses, selectedExpenseFilters.length, t]);

  const expenseChartData = useMemo(() => {
    return {
      labels: filteredExpenses.map((item: { key: ExpenseCategory; label: string; value: number; percentage: number; color: string }) => item.label),
      datasets: [
        {
          data: filteredExpenses.map((item: { key: ExpenseCategory; label: string; value: number; percentage: number; color: string }) => item.value),
          backgroundColor: filteredExpenses.map((item: { key: ExpenseCategory; label: string; value: number; percentage: number; color: string }) => {
            const colorIndex = financesOptions.expense.findIndex((option) => option.value === item.key);
            return EXPENSE_ACTIVE_COLORS[colorIndex] ?? '#2563eb';
          }),
          hoverBackgroundColor: filteredExpenses.map((item: { key: ExpenseCategory; label: string; value: number; percentage: number; color: string }) => {
            const colorIndex = financesOptions.expense.findIndex((option) => option.value === item.key);
            return EXPENSE_ACTIVE_COLORS[colorIndex] ?? '#1d4ed8';
          }),
          borderWidth: 0,
        },
      ],
    };
  }, [filteredExpenses, financesOptions]);

  const remainingExpenseOptions = useMemo(
    () => financesOptions.expense.filter((option) => !selectedExpenseFilters.includes(option.value as ExpenseCategory)),
    [selectedExpenseFilters, financesOptions],
  );

  const expenseChartOptions = useMemo<ChartOptions<'doughnut'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { weight: 600 },
          bodyFont: { weight: 500 },
          callbacks: {
            label: (context) => {
              const value = context.raw as number;
              const label = context.label ?? '';
              return `${label}: ${formatNumber(value, { maximumFractionDigits: 1 })} ${currencyUnitShort}`;
            },
          },
        },
      },
    }),
    [currencyUnitShort],
  );

  const realFinancingTypeOptions = useMemo(
    () => financesOptions.financingType.filter((option) => option.value !== 'all'),
    [financesOptions],
  );

  const financingTypeBreakdown = useMemo(() => {
    const countByType = new Map((apiFilterMeta?.financingType ?? []).map((item) => [item.value, item.count]));
    const totalCount = Array.from(countByType.values()).reduce((acc, count) => acc + count, 0);

    return realFinancingTypeOptions.map((option, index) => {
      const count = countByType.get(option.value) ?? 0;
      const share = totalCount > 0 ? count / totalCount : 0;
      const value = Number((adjustedMetrics.finances.total * share).toFixed(1));
      return {
        key: option.value as FinancingType,
        label: option.label,
        value,
        percentage: Number((share * 100).toFixed(1)),
        color: FINANCING_TYPE_COLORS[index % FINANCING_TYPE_COLORS.length],
      };
    });
  }, [adjustedMetrics.finances.total, apiFilterMeta, realFinancingTypeOptions]);

  const selectedFinancingTypeFilters = chartFilters.financingTypes;
  const activeFinancingTypeFilters = selectedFinancingTypeFilters.length
    ? selectedFinancingTypeFilters
    : realFinancingTypeOptions.map((option) => option.value);

  const filteredFinancingTypes = useMemo(
    () => financingTypeBreakdown.filter((item: { key: FinancingType; label: string; value: number; percentage: number; color: string }) => activeFinancingTypeFilters.includes(item.key)),
    [financingTypeBreakdown, activeFinancingTypeFilters],
  );

  const selectedFinancingTypeTotal = useMemo(
    () => filteredFinancingTypes.reduce((acc: number, item: { key: FinancingType; label: string; value: number; percentage: number; color: string }) => acc + item.value, 0),
    [filteredFinancingTypes],
  );

  const selectedFinancingLabel = useMemo(() => {
    if (!selectedFinancingTypeFilters.length) {
      return t('fin_all_types');
    }
    if (filteredFinancingTypes.length === 1) {
      return filteredFinancingTypes[0]?.label ?? '';
    }
    return t('finances_selected_count', { count: filteredFinancingTypes.length });
  }, [filteredFinancingTypes, selectedFinancingTypeFilters.length, t]);

  const financingTypeChartData = useMemo(() => {
    return {
      labels: filteredFinancingTypes.map((item: { key: FinancingType; label: string; value: number; percentage: number; color: string }) => item.label),
      datasets: [
        {
          data: filteredFinancingTypes.map((item: { key: FinancingType; label: string; value: number; percentage: number; color: string }) => item.value),
          backgroundColor: filteredFinancingTypes.map((item: { key: FinancingType; label: string; value: number; percentage: number; color: string }) => {
            const colorIndex = financesOptions.financingType.findIndex((option) => option.value === item.key);
            return FINANCING_TYPE_COLORS[colorIndex] ?? '#2563eb';
          }),
          hoverBackgroundColor: filteredFinancingTypes.map((item: { key: FinancingType; label: string; value: number; percentage: number; color: string }) => {
            const colorIndex = financesOptions.financingType.findIndex((option) => option.value === item.key);
            return FINANCING_TYPE_COLORS[colorIndex] ?? '#1d4ed8';
          }),
          borderWidth: 0,
        },
      ],
    };
  }, [filteredFinancingTypes, financesOptions]);

  const remainingFinancingTypeOptions = useMemo(
    () => realFinancingTypeOptions.filter((option) => !selectedFinancingTypeFilters.includes(option.value as FinancingType)),
    [selectedFinancingTypeFilters, realFinancingTypeOptions],
  );

  const financingTypeChartOptions = useMemo<ChartOptions<'doughnut'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { weight: 600 },
          bodyFont: { weight: 500 },
          callbacks: {
            label: (context) => {
              const value = context.raw as number;
              const label = context.label ?? '';
              return `${label}: ${formatNumber(value, { maximumFractionDigits: 1 })} ${currencyUnitShort}`;
            },
          },
        },
      },
    }),
    [currencyUnitShort],
  );

  const topRegions = useMemo(
    () =>
      regions
        .map((region) => ({
          id: region.id,
          name: region.name,
          total: region.stats.finances.total,
          lastYear: region.stats.finances.lastYear,
          budgetUsage: region.stats.finances.budgetUsage,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6),
    [regions],
  );

  const comparisonRows = useMemo(() => {
    if (!selectedRegion) {
      return [];
    }

    const share = (adjustedMetrics.finances.total / nationalMetrics.finances.total) * 100;

    return [
      {
        label: t('comparison_projects_count'),
        // label: 'Финансирование, млрд. тг',
        regionValue: `${formatNumber(adjustedMetrics.finances.total, { maximumFractionDigits: 1 })}`,
        nationalValue: `${formatNumber(nationalMetrics.finances.total, { maximumFractionDigits: 1 })}`,
        delta: t('finances_share_value', { value: share.toFixed(1) }),
      },
      {
        label: t('comparison_total_finances'),
        // label: 'Финансирование за прошлый год, млрд. тг',
        regionValue: `${formatNumber(adjustedMetrics.finances.lastYear, { maximumFractionDigits: 1 })}`,
        nationalValue: `${formatNumber(nationalMetrics.finances.lastYear, { maximumFractionDigits: 1 })}`,
        delta: t('finances_share_value', {
          value: ((adjustedMetrics.finances.lastYear / nationalMetrics.finances.lastYear) * 100).toFixed(1),
        }),
      },
      {
        label: t('comparison_avg_expense'),
        regionValue: `${formatNumber(adjustedMetrics.finances.avgExpense)}`,
        nationalValue: `${formatNumber(nationalMetrics.finances.avgExpense)}`,
        delta: t('finances_difference_currency', {
          value: (adjustedMetrics.finances.avgExpense - nationalMetrics.finances.avgExpense).toFixed(0),
        }),
      },
      {
        label: t('comparison_budget_usage'),
        regionValue: `${formatNumber(adjustedMetrics.finances.budgetUsage, { maximumFractionDigits: 1 })}%`,
        nationalValue: `${formatNumber(nationalMetrics.finances.budgetUsage, { maximumFractionDigits: 1 })}%`,
        delta: t('finances_difference_pp', {
          value: (adjustedMetrics.finances.budgetUsage - nationalMetrics.finances.budgetUsage).toFixed(1),
        }),
      },
      {
        label: t('comparison_regional_programs'),
        regionValue: `${formatNumber(adjustedMetrics.finances.regionalPrograms)}`,
        nationalValue: `${formatNumber(nationalMetrics.finances.regionalPrograms)}`,
        delta: t('finances_share_value', {
          value: (
            (adjustedMetrics.finances.regionalPrograms / nationalMetrics.finances.regionalPrograms) * 100
          ).toFixed(1),
        }),
      },
    ];
  }, [adjustedMetrics, nationalMetrics, selectedRegion, t]);

  const highlightCards = [
    {
      title: t('card_total_financing'),
      value: `${formatNumber(adjustedMetrics.finances.total, { maximumFractionDigits: 1 })} ${currencyUnitShort}`,
      icon: DollarSign,
      iconBg: 'rgba(59, 130, 246, 0.15)',
      iconColor: '#2563eb',
      accent: 'rgba(59, 130, 246, 0.35)',
    },
    {
      title: t('card_current_year_financing'),
      value: `${formatNumber(adjustedMetrics.finances.lastYear, { maximumFractionDigits: 1 })} ${currencyUnitShort}`,
      icon: TrendingUp,
      iconBg: 'rgba(16, 185, 129, 0.15)',
      iconColor: '#059669',
      accent: 'rgba(16, 185, 129, 0.28)',
    },
  ];

  const handleRegionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRegionId(event.target.value as RegionId);
  };

  const handleIrnChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setFilters((prev) => ({ ...prev, irn: event.target.value }));
    },
    [setFilters],
  );

  const handleFinancingTypeSelect = useCallback(
    (value: FinancingType) => {
      setFilters((prev) => ({ ...prev, financingType: value }));
    },
    [setFilters],
  );

  const handleFinancingTypeChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      handleFinancingTypeSelect(event.target.value as FinancingType);
    },
    [handleFinancingTypeSelect],
  );

  const handlePriorityChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as PriorityDirection;
    setFilters((prev) => ({ ...prev, priority: value }));
  }, []);

  const handleCompetitionChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as CompetitionName;
    setFilters((prev) => ({ ...prev, competition: value }));
  }, []);

  const handleApplicantChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as ApplicantType;
    setFilters((prev) => ({ ...prev, applicant: value }));
  }, []);

  const handleCustomerChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as CustomerType;
    setFilters((prev) => ({ ...prev, customer: value }));
  }, []);

  const handleStatusChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as ProjectStatus;
    setFilters((prev) => ({ ...prev, status: value }));
  }, []);

  const handleCofinancingChartSelect = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as CofinancingType;
      if (!value) {
        return;
      }
      handleChartFilterAdd('cofinancing', value);
      event.currentTarget.value = '';
    },
    [handleChartFilterAdd],
  );

  const handleExpenseChartSelect = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as ExpenseCategory;
      if (!value) {
        return;
      }
      handleChartFilterAdd('expenses', value);
      event.currentTarget.value = '';
    },
    [handleChartFilterAdd],
  );

  const handleFinancingTypeChartSelect = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as FinancingType;
      if (!value) {
        return;
      }
      handleChartFilterAdd('financingTypes', value);
      event.currentTarget.value = '';
    },
    [handleChartFilterAdd],
  );

  const removeCofinancingChip = useCallback(
    (value: CofinancingType) => {
      handleChartFilterRemove('cofinancing', value);
    },
    [handleChartFilterRemove],
  );

  const removeExpenseChip = useCallback(
    (value: ExpenseCategory) => {
      handleChartFilterRemove('expenses', value);
    },
    [handleChartFilterRemove],
  );

  const removeFinancingChip = useCallback(
    (value: FinancingType) => {
      handleChartFilterRemove('financingTypes', value);
    },
    [handleChartFilterRemove],
  );

  const handleYearRangeChange = useCallback(
    (key: 'startYear' | 'endYear', value: number) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: clampValue(value, periodRange.min, periodRange.max) };
        if (next.startYear > next.endYear) {
          if (key === 'startYear') {
            next.endYear = next.startYear;
          } else {
            next.startYear = next.endYear;
          }
        }
        return next;
      });
    },
    [periodRange.max, periodRange.min],
  );

  const periodRangeStyle = useMemo(() => {
    const total = Math.max(periodRange.max - periodRange.min, 1);
    const startProgress = ((filters.startYear - periodRange.min) / total) * 100;
    const endProgress = ((filters.endYear - periodRange.min) / total) * 100;
    return {
      '--range-start': `${startProgress}%`,
      '--range-end': `${endProgress}%`,
    } as CSSProperties;
  }, [filters.endYear, filters.startYear, periodRange.max, periodRange.min]);

  const handleMapSelect = useCallback(
    (regionId: string) => {
      const typedId = regionId as RegionId;
      const nextRegionId = selectedRegionId === typedId ? 'national' : typedId;
      setSelectedRegionId(nextRegionId);
    },
    [selectedRegionId, setSelectedRegionId],
  );

  return (
    <div className="finances-page">
      <header className="finances-header">
        <div>
          <h1>{t('finances_page_heading')}</h1>
          <p>
            {t('finances_page_description', { region: regionLabel })}
          </p>
          {summaryError && <p>{summaryError}</p>}
        </div>
        <div className="finances-controls">
          <label className="sr-only" htmlFor="finances-region-select">
            {t('finances_select_region_label')}
          </label>
          <select
            id="finances-region-select"
            value={selectedRegionId}
            onChange={handleRegionChange}
            className="finances-region-select"
          >
            <option value="national">{t('finances_region_all_label')}</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="finances-filter-bar" aria-label={t('finances_filters_aria_label')}>
        <div className="finances-filter-group">
          <label htmlFor="filter-irn">{t('finances_filter_irn')}</label>
          <select
            id="filter-irn"
            className="finances-filter-select"
            value={filters.irn}
            onChange={handleIrnChange}
          >
            {IRN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="finances-filter-group finances-filter-group--range">
          <div className="finances-filter-label">
            <label htmlFor="filter-period">{t('filter_year_range')}</label>
            <span className="finances-filter-value">{filters.startYear} — {filters.endYear}</span>
          </div>
          <div className="period-range-slider" style={periodRangeStyle}>
            <div className="period-range-values">
              <span className="period-range-value">{filters.startYear}</span>
              <span className="period-range-value">{filters.endYear}</span>
            </div>
            <div className="period-range-track" />
            <div className="period-range-inputs">
              <input
                id="filter-period"
                type="range"
                min={periodRange.min}
                max={periodRange.max}
                step={1}
                value={filters.startYear}
                onChange={(event) => handleYearRangeChange('startYear', Number(event.target.value))}
                className="period-range-thumb"
              />
              <input
                type="range"
                min={periodRange.min}
                max={periodRange.max}
                step={1}
                value={filters.endYear}
                onChange={(event) => handleYearRangeChange('endYear', Number(event.target.value))}
                className="period-range-thumb period-range-thumb--upper"
              />
            </div>
          </div>
        </div>

        <div className="finances-filter-group">
          <label htmlFor="filter-type">{t('finances_filter_financing_type')}</label>
          <select
            id="filter-type"
            className="finances-filter-select"
            value={filters.financingType}
            onChange={handleFinancingTypeChange}
          >
            {FINANCING_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="finances-filter-group">
          <label htmlFor="filter-priority">{t('finances_filter_priority')}</label>
          <select
            id="filter-priority"
            className="finances-filter-select"
            value={filters.priority}
            onChange={handlePriorityChange}
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="finances-filter-group">
          <label htmlFor="filter-competition">{t('finances_filter_competition')}</label>
          <select
            id="filter-competition"
            className="finances-filter-select"
            value={filters.competition}
            onChange={handleCompetitionChange}
          >
            {COMPETITION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="finances-filter-group">
          <label htmlFor="filter-applicant">{t('finances_filter_applicant')}</label>
          <select
            id="filter-applicant"
            className="finances-filter-select"
            value={filters.applicant}
            onChange={handleApplicantChange}
          >
            {APPLICANT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="finances-filter-group">
          <label htmlFor="filter-customer">{t('finances_filter_customer')}</label>
          <select
            id="filter-customer"
            className="finances-filter-select"
            value={filters.customer}
            onChange={handleCustomerChange}
          >
            {CUSTOMER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="finances-filter-group">
          <label htmlFor="filter-status">{t('finances_filter_status')}</label>
          <select
            id="filter-status"
            className="finances-filter-select"
            value={filters.status}
            onChange={handleStatusChange}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {isSummaryLoading && <PageLoader />}

      {!isSummaryLoading && (
      <>
      <section className="finances-visuals" aria-label={t('finances_visuals_aria_label')}>
        <div className="finances-top-row">
          <article className="finances-map-card">
            <header className="finances-map-header">
              <div>
                <span className="finances-map-tag">{t('finances_map_tag_title')}</span>
                <h2>{regionLabel}</h2>
              </div>
              <span className="finances-map-hint">{t('finances_map_hint')}</span>
            </header>

            <div className="finances-map-frame">
              <KazakhstanMap selectedRegionId={selectedRegionId} onRegionSelect={handleMapSelect} />
            </div>
          </article>

          <article
            className="finances-chart-card finances-chart-card--primary finances-chart-card--expense"
            aria-label={t('finances_expense_distribution_aria')}
          >
            <header className="finances-chart-header">
              <h2>{t('finances_expense_distribution_title')}</h2>
              <span>{t('finances_expense_distribution_subtitle')}</span>
            </header>
            <div className="finances-chip-select-row">
              <label htmlFor="expenses-chart-filter">{t('finances_add_category_label')}</label>
              <select
                id="expenses-chart-filter"
                className="finances-chip-select"
                value=""
                onChange={handleExpenseChartSelect}
                disabled={remainingExpenseOptions.length === 0}
              >
                <option value="" disabled>
                  {remainingExpenseOptions.length ? t('fin_select_category') : t('fin_all_added_category')}
                </option>
                {remainingExpenseOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="finances-chip-list" aria-live="polite">
              {selectedExpenseFilters.length ? (
                selectedExpenseFilters.map((value) => {
                  const option = EXPENSE_OPTIONS.find((item: { value: string; label: string }) => item.value === value);
                  return (
                    <span key={value} className="finances-chip-pill">
                      {option?.label ?? value}
                      <button
                        type="button"
                        className="finances-chip-remove"
                          aria-label={t('finances_remove_category_aria', { label: option?.label ?? value })}
                        onClick={() => removeExpenseChip(value)}
                      >
                        ×
                      </button>
                    </span>
                  );
                })
              ) : (
                  <span className="finances-chip-placeholder">{t('finances_categories_placeholder')}</span>
              )}
            </div>
            <div className="finances-distribution-content">
              <div className="finances-doughnut-wrapper finances-doughnut-wrapper--wide">
                <Doughnut data={expenseChartData} options={expenseChartOptions} updateMode="resize" />
                <div className="finances-doughnut-center">
                  <span className="value">
                    {formatNumber(selectedExpenseTotal, { maximumFractionDigits: 1 })}
                  </span>
                  <span className="label">{currencyUnitShort}</span>
                  <span className="sub-label">{selectedExpenseLabel}</span>
                </div>
              </div>
              <button
                type="button"
                className="finances-drawer-toggle"
                onClick={() => setExpenseDrawerOpen((prev) => !prev)}
                aria-expanded={isExpenseDrawerOpen}
                aria-controls="expense-breakdown"
              >
                {isExpenseDrawerOpen ? t('fin_hide_details') : t('fin_show_details')}
                <span aria-hidden="true">{isExpenseDrawerOpen ? '-' : '+'}</span>
              </button>
              <div
                id="expense-breakdown"
                className={`finances-breakdown-drawer${isExpenseDrawerOpen ? ' is-open' : ''}`}
              >
                <div
                  className="finances-breakdown-scroll"
                  role="region"
                  aria-label={t('finances_expense_details_aria')}
                  tabIndex={0}
                >
                  <ul className="finances-breakdown-list">
                    {filteredExpenses.map((item) => (
                      <li
                        key={item.key}
                        className={filters.expense === item.key ? 'active' : undefined}
                      >
                        <span
                          className="finances-breakdown-dot"
                          style={{ backgroundColor: item.color }}
                          aria-hidden="true"
                        />
                        <div className="finances-breakdown-text">
                          <span className="finances-breakdown-value">
                            {formatNumber(item.value, { maximumFractionDigits: 1 })} {currencyUnitShort}
                          </span>
                          <span className="finances-breakdown-label">{item.label}</span>
                        </div>
                        <span className="finances-breakdown-percentage">{item.percentage.toFixed(1)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </article>

          <article
            className="finances-chart-card finances-chart-card--compact finances-chart-card--donut"
            aria-label={t('finances_type_distribution_aria')}
          >
            <header className="finances-chart-header">
              <h2>{t('finances_type_distribution_title')}</h2>
              <span>{t('finances_type_distribution_subtitle')}</span>
            </header>
            <div className="finances-chip-select-row">
              <label htmlFor="financing-type-chart-filter">{t('finances_add_type_label')}</label>
              <select
                id="financing-type-chart-filter"
                className="finances-chip-select"
                value=""
                onChange={handleFinancingTypeChartSelect}
                disabled={remainingFinancingTypeOptions.length === 0}
              >
                <option value="" disabled>
                  {remainingFinancingTypeOptions.length ? t('fin_select_type') : t('fin_all_added_type')}
                </option>
                {remainingFinancingTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="finances-chip-list" aria-live="polite">
              {selectedFinancingTypeFilters.length ? (
                selectedFinancingTypeFilters.map((value) => {
                  const option = FINANCING_TYPE_OPTIONS.find((item: { value: string; label: string }) => item.value === value);
                  return (
                    <span key={value} className="finances-chip-pill">
                      {option?.label ?? value}
                      <button
                        type="button"
                        className="finances-chip-remove"
                          aria-label={t('finances_remove_type_aria', { label: option?.label ?? value })}
                        onClick={() => removeFinancingChip(value)}
                      >
                        ×
                      </button>
                    </span>
                  );
                })
              ) : (
                  <span className="finances-chip-placeholder">{t('finances_types_placeholder')}</span>
              )}
            </div>
            <div className="finances-distribution-content">
              <div className="finances-doughnut-wrapper finances-doughnut-wrapper--wide">
                <Doughnut
                  data={financingTypeChartData}
                  options={financingTypeChartOptions}
                  updateMode="resize"
                />
                <div className="finances-doughnut-center">
                  <span className="value">
                    {formatNumber(selectedFinancingTypeTotal, { maximumFractionDigits: 1 })}
                  </span>
                  <span className="label">{currencyUnitShort}</span>
                  <span className="sub-label">{selectedFinancingLabel}</span>
                </div>
              </div>
              <button
                type="button"
                className="finances-drawer-toggle"
                onClick={() => setFinancingDrawerOpen((prev) => !prev)}
                aria-expanded={isFinancingDrawerOpen}
                aria-controls="financing-breakdown"
              >
                {isFinancingDrawerOpen ? t('fin_hide_details') : t('fin_show_details')}
                <span aria-hidden="true">{isFinancingDrawerOpen ? '-' : '+'}</span>
              </button>
              <div
                id="financing-breakdown"
                className={`finances-breakdown-drawer${isFinancingDrawerOpen ? ' is-open' : ''}`}
              >
                <div
                  className="finances-breakdown-scroll"
                  role="region"
                  aria-label={t('finances_type_details_aria')}
                  tabIndex={0}
                >
                  <ul className="finances-breakdown-list finances-breakdown-list--inline">
                    {filteredFinancingTypes.map((item) => (
                      <li
                        key={item.key}
                        className={filters.financingType === item.key ? 'active' : undefined}
                      >
                        <span
                          className="finances-breakdown-dot"
                          style={{ backgroundColor: item.color }}
                          aria-hidden="true"
                        />
                        <span className="finances-breakdown-label">{item.label}</span>
                        <span className="finances-breakdown-value">
                          {formatNumber(item.value, { maximumFractionDigits: 1 })} {currencyUnitShort}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </article>
        </div>

        <div className="finances-line-column">
          <article
            className="finances-chart-card finances-chart-card--primary"
            aria-label={t('finances_cofinancing_card_title')}
          >
            <header className="finances-chart-header">
              <h2>{t('finances_cofinancing_card_title')}</h2>
              <span>{t('finances_cofinancing_card_subtitle')}</span>
            </header>
            <div className="finances-chip-select-row">
              <label htmlFor="cofinancing-chart-filter">{t('finances_add_indicator_label')}</label>
              <select
                id="cofinancing-chart-filter"
                className="finances-chip-select"
                value=""
                onChange={handleCofinancingChartSelect}
                disabled={remainingCofinancingOptions.length === 0}
              >
                <option value="" disabled>
                  {remainingCofinancingOptions.length ? t('fin_select_indicator') : t('fin_all_added_indicator')}
                </option>
                {remainingCofinancingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="finances-chip-list" aria-live="polite">
              {selectedCofinancingFilters.length ? (
                selectedCofinancingFilters.map((value) => {
                  const option = COFINANCING_OPTIONS.find((item: { value: string; label: string }) => item.value === value);
                  return (
                    <span key={value} className="finances-chip-pill">
                      {option?.label ?? value}
                      <button
                        type="button"
                        className="finances-chip-remove"
                          aria-label={t('finances_remove_indicator_aria', { label: option?.label ?? value })}
                        onClick={() => removeCofinancingChip(value)}
                      >
                        ×
                      </button>
                    </span>
                  );
                })
              ) : (
                  <span className="finances-chip-placeholder">{t('finances_filters_placeholder')}</span>
              )}
            </div>
            <div className="finances-chart">
              <Bar data={cofinancingChartData} options={cofinancingChartOptions} updateMode="resize" />
            </div>
          </article>

          <article
            className="finances-chart-card finances-chart-card--compact finances-chart-card--approval"
            aria-label={t('finances_chart_approval')}
          >
            <header className="finances-chart-header">
              <h2>{t('finances_chart_approval')}</h2>
              <span>{t('finances_chart_in_bln')}</span>
            </header>
            <div className="finances-chart finances-chart--mini">
              <Bar data={approvalChartData} options={approvalChartOptions} updateMode="resize" />
            </div>
          </article>
        </div>
      </section>

      <section className="finances-highlight" aria-label={t('finances_highlight_aria')}>
        {highlightCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="finances-highlight-card"
              style={{ '--highlight-accent': card.accent } as CSSProperties}
            >
              <span className="finances-highlight-icon" style={{ backgroundColor: card.iconBg, color: card.iconColor }}>
                <Icon size={20} aria-hidden="true" />
              </span>
              <div className="finances-highlight-content">
                <span className="finances-highlight-label">{card.title}</span>
                <span className="finances-highlight-value">{card.value}</span>
              </div>
            </article>
          );
        })}
      </section>

      <div className="finances-grid">
        <section className="finances-top" aria-label={t('finances_leaders_aria')}>
          <header className="finances-panel-header">
            <h2>{t('finances_leaders_title')}</h2>
            <span>{t('finances_leaders_subtitle')}</span>
          </header>
          <table>
            <thead>
              <tr>
                <th>{t('table_header_region')}</th>
                <th>{t('table_header_financing')}</th>
                <th>{t('table_header_previous_year')}</th>
                <th>{t('comparison_budget_usage')}</th>
              </tr>
            </thead>
            <tbody>
              {topRegions.map((region) => (
                <tr key={region.id} className={region.id === selectedRegionId ? 'active-row' : undefined}>
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setSelectedRegionId(region.id as RegionId)}
                    >
                      {region.name}
                    </button>
                  </td>
                  <td>{formatNumber(region.total, { maximumFractionDigits: 1 })}</td>
                  <td>{formatNumber(region.lastYear, { maximumFractionDigits: 1 })}</td>
                  <td>{formatNumber(region.budgetUsage, { maximumFractionDigits: 1 })}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="finances-comparison" aria-label={t('finances_comparison_aria')}>
          <header className="finances-panel-header">
            <h2>{t('comparison_national_level')}</h2>
            {!isNational && <span>{selectedRegion?.name}</span>}
          </header>
          {isNational ? (
            <p className="finances-placeholder">
              {t('comparison_placeholder')}
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t('table_header_indicator')}</th>
                  <th>{selectedRegion?.shortName ?? t('table_header_region_short')}</th>
                  <th>{t('table_header_republic')}</th>
                  <th>{t('table_header_share_delta')}</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{row.regionValue}</td>
                    <td>{row.nationalValue}</td>
                    <td>{row.delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
      </>
      )}
    </div>
  );
};

export default FinancesPage;
