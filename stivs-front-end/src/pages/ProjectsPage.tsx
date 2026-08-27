import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Search, ArrowUpDown, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { useRegionContext } from '../context/RegionContext';
import type { RegionId } from '../context/RegionContext';
import { useTranslation } from 'react-i18next';
import './ProjectsPage.css';
import { mapRegionToId, projectsApi } from '../api/services';
import type { BackendProject } from '../api/types';
import { useProjectsData } from '../hooks/useProjectsData';
import PageLoader from '../components/PageLoader/PageLoader';
import { exportPdfReport } from '../utils/exportPdfReport';

type ProjectStatus = 'active' | 'completed' | 'draft';
type TrlLevel = 3 | 4 | 5 | 6 | 7 | 8 | 9;
type DropdownFilterKey = 'irn' | 'financingType' | 'applicant' | 'customer' | 'mrnti';

interface Project {
	id: string;
	irn: string;
	title: string;
	applicant: string;
	supervisor: string;
	priority: string;
	contest: string;
	financingType: string;
	financingTotal: number;
	regionId: RegionId;
	customer: string;
	mrnti: string;
	status: ProjectStatus;
	trl: TrlLevel;
	startYear: number;
	endYear: number;
}

const YEAR_RANGE = { min: 2021, max: 2025 } as const;
const PAGE_LIMIT = 20;
const DEFAULT_FILTERS: FilterState = {
	search: '',
	startYear: YEAR_RANGE.min,
	endYear: YEAR_RANGE.max,
	irn: 'all',
	financingType: 'all',
	priority: 'all',
	contest: 'all',
	applicant: 'all',
	customer: 'all',
	mrnti: 'all',
	status: 'all',
	trl: 'all',
};

type ColumnKey =
	| 'irn'
	| 'title'
	| 'applicant'
	| 'priority'
	| 'financingType'
	| 'financingTotal'
	| 'region'
	| 'status'
	| 'period';

interface ColumnDefinition {
	key: ColumnKey;
	label: string;
	sortKey?: keyof Project;
}

interface OptionItem {
	value: string;
	label: string;
}

interface SearchableSelectProps {
	id: string;
	label: string;
	placeholder: string;
	options: OptionItem[];
	value: string;
	isOpen: boolean;
	searchValue: string;
	onToggle: () => void;
	onSelect: (value: string) => void;
	onSearchChange: (value: string) => void;
	setRef: (node: HTMLDivElement | null) => void;
}

const dropdownKeys: DropdownFilterKey[] = ['irn', 'financingType', 'applicant', 'customer', 'mrnti'];

const SearchableSelect: React.FC<SearchableSelectProps> = ({
	id,
	label,
	placeholder,
	options,
	value,
	isOpen,
	searchValue,
	onToggle,
	onSelect,
	onSearchChange,
	setRef,
}) => {
	const normalizedSearch = searchValue.trim().toLowerCase();
	const filteredOptions = useMemo(() => {
		if (!isOpen) {
			return [] as OptionItem[];
		}

		const matched = normalizedSearch.length === 0
			? options
			: options.filter((option) => option.label.toLowerCase().includes(normalizedSearch));

		const maxVisible = normalizedSearch.length === 0 ? 250 : 500;
		return matched.slice(0, maxVisible);
	}, [isOpen, normalizedSearch, options]);
	const isTrimmed = isOpen && normalizedSearch.length === 0 && options.length > filteredOptions.length;
	const activeOption = options.find((option) => option.value === value);
	const selectClassName = `projects-select${isOpen ? ' projects-select--open' : ''}`;
	const valueClassName = `projects-select-value${value === 'all' ? ' projects-select-value--placeholder' : ''}`;

	return (
		<div className={selectClassName} ref={setRef}>
			<button
				type="button"
				className="projects-select-trigger"
				onClick={onToggle}
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				id={id}
			>
				<span className={valueClassName}>{activeOption?.label ?? placeholder}</span>
				<ChevronDown size={16} />
			</button>
				{isOpen && (
					<div className="projects-select-dropdown" role="listbox" aria-labelledby={id}>
					<div className="projects-select-search">
						<Search size={14} />
						<input
							type="text"
							value={searchValue}
							onChange={(event) => onSearchChange(event.target.value)}
							placeholder={`Поиск по ${label.toLowerCase()}`}
						/>
					</div>
					<ul className="projects-select-options">
						{filteredOptions.length === 0 ? (
							<li className="projects-select-empty">Ничего не найдено</li>
						) : (
							filteredOptions.map((option) => (
								<li key={option.value}>
									<button
										type="button"
										className={`projects-select-option${option.value === value ? ' projects-select-option--active' : ''}`}
										onClick={() => onSelect(option.value)}
									>
										{option.label}
									</button>
								</li>
							))
						)}
						{isTrimmed && (
							<li className="projects-select-empty">Показаны первые {filteredOptions.length} значений. Уточните поиск.</li>
						)}
					</ul>
				</div>
			)}
		</div>
	);
};

interface FilterState {
	search: string;
	startYear: number;
	endYear: number;
	irn: string;
	financingType: string;
	priority: string;
	contest: string;
	applicant: string;
	customer: string;
	mrnti: string;
	status: string;
	trl: TrlLevel | 'all';
}

interface SortState {
	key: keyof Project | '';
	direction: 'asc' | 'desc' | '';
}

const formatCurrency = (value: number): string =>
	new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency: 'KZT',
		maximumFractionDigits: 0,
	}).format(value);

const toProjectStatus = (value: string): ProjectStatus => {
	if (value === 'active') {
		return 'active';
	}
	if (value === 'completed') {
		return 'completed';
	}
	return 'draft';
};

const toProject = (item: BackendProject): Project => {
	const startYear = item.startDate ? new Date(item.startDate).getFullYear() : YEAR_RANGE.min;
	const endYear = item.endDate ? new Date(item.endDate).getFullYear() : YEAR_RANGE.max;

	return {
		id: item.id,
		irn: item.id.toUpperCase(),
		title: item.title,
		applicant: item.lead || '—',
		supervisor: item.lead || '—',
		priority: item.priority || '—',
		contest: item.contest || '—',
		financingType: item.financingType || '—',
		financingTotal: item.budget,
		regionId: mapRegionToId(item.region) as RegionId,
		customer: item.customer || '—',
		mrnti: item.mrnti || '—',
		status: toProjectStatus(item.status),
		trl: (item.trl && item.trl >= 3 && item.trl <= 9 ? item.trl : 4) as TrlLevel,
		startYear: Number.isFinite(startYear) ? startYear : YEAR_RANGE.min,
		endYear: Number.isFinite(endYear) ? endYear : YEAR_RANGE.max,
	};
};

const ProjectsPage: React.FC = () => {
	const { t } = useTranslation();
	const { selectedRegionId, setSelectedRegionId, regions } = useRegionContext();
	
	// Динамические переводы
	const priorityLabels = useMemo<Record<string, string>>(
		() => ({
			health: t('projects_priority_health'),
			economy: t('projects_priority_economy'),
			ecology: t('projects_priority_ecology'),
			energy: t('projects_priority_energy'),
			transport: t('projects_priority_transport'),
			ai: t('projects_priority_ai'),
		}),
		[t],
	);

	const financingLabels = useMemo<Record<string, string>>(
		() => ({
			grant: t('projects_financing_grant'),
			program: t('projects_financing_program'),
			contract: t('projects_financing_contract'),
		}),
		[t],
	);

	const statusLabels = useMemo<Record<string, string>>(
		() => ({
			active: t('projects_status_active'),
			completed: t('projects_status_completed'),
			draft: t('projects_status_draft'),
		}),
		[t],
	);
	
	const columnLabels = useMemo(
		() => ({
			irn: t('projects_column_irn'),
			title: t('projects_column_title'),
			applicant: t('projects_column_applicant'),
			priority: t('projects_column_priority'),
			financingType: t('projects_column_financing_type'),
			financingTotal: t('projects_column_amount'),
			region: t('projects_column_region'),
			status: t('projects_column_status'),
			period: t('projects_column_period'),
		}),
		[t],
	);
	
	const columnDefinitionsLocal: ColumnDefinition[] = useMemo(
		() => [
			{ key: 'irn', label: columnLabels.irn, sortKey: 'irn' },
			{ key: 'title', label: columnLabels.title, sortKey: 'title' },
			{ key: 'applicant', label: columnLabels.applicant, sortKey: 'applicant' },
			{ key: 'priority', label: columnLabels.priority },
			{ key: 'financingType', label: columnLabels.financingType },
			{ key: 'financingTotal', label: columnLabels.financingTotal, sortKey: 'financingTotal' },
			{ key: 'region', label: columnLabels.region },
			{ key: 'status', label: columnLabels.status },
			{ key: 'period', label: columnLabels.period },
		],
		[columnLabels],
	);
	
	const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
	const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
	const [sort, setSort] = useState<SortState>({ key: '', direction: '' });
	const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(() =>
		columnDefinitionsLocal.reduce(
			(acc, column) => ({
				...acc,
				[column.key]: true,
			}),
			{} as Record<ColumnKey, boolean>,
		),
	);
	const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);
	const columnPickerRef = useRef<HTMLDivElement | null>(null);
	const [openDropdown, setOpenDropdown] = useState<DropdownFilterKey | null>(null);
	const [dropdownSearch, setDropdownSearch] = useState<Record<DropdownFilterKey, string>>(() =>
		dropdownKeys.reduce((acc, key) => {
			acc[key] = '';
			return acc;
		}, {} as Record<DropdownFilterKey, string>),
	);
	const dropdownRefs = useRef<Partial<Record<DropdownFilterKey, HTMLDivElement | null>>>({});
	const regionNameById = useMemo(() => {
		const map: Record<string, string> = {};
		regions.forEach((region) => {
			map[region.id] = region.name;
		});
		return map;
	}, [regions]);

	const {
		projectsData,
		isLoading,
		hasLoaded,
		loadError,
		projectFilters,
		projectFiltersMeta,
		pageMeta,
	} = useProjectsData({
		filters: appliedFilters,
		debouncedSearch: appliedFilters.search,
		selectedRegionId,
		regionNameById,
		currentPage,
		pageLimit: PAGE_LIMIT,
		fallbackItems: [],
		mapItem: toProject,
	});

	const irnOptions = useMemo(
		() => ['all', ...(projectFilters?.irn.length ? projectFilters.irn : [...new Set(projectsData.map((item) => item.irn))])],
		[projectFilters?.irn, projectsData],
	);
	const financingTypeOptions = useMemo(
		() => ['all', ...(projectFilters?.financingType.length ? projectFilters.financingType : ['grant', 'program', 'contract'])],
		[projectFilters?.financingType],
	);
	const priorityOptions = useMemo(
		() => ['all', ...(projectFilters?.priority.length ? projectFilters.priority : Object.keys(priorityLabels))],
		[priorityLabels, projectFilters?.priority],
	);
	const contestOptions = useMemo(
		() => ['all', ...(projectFilters?.contest.length ? projectFilters.contest : [...new Set(projectsData.map((item) => item.contest))])],
		[projectFilters?.contest, projectsData],
	);
	const applicantOptions = useMemo(
		() => ['all', ...(projectFilters?.applicant.length ? projectFilters.applicant : [...new Set(projectsData.map((item) => item.applicant))])],
		[projectFilters?.applicant, projectsData],
	);
	const customerOptions = useMemo(
		() => ['all', ...(projectFilters?.customer.length ? projectFilters.customer : [...new Set(projectsData.map((item) => item.customer))])],
		[projectFilters?.customer, projectsData],
	);
	const mrntiOptions = useMemo(
		() => ['all', ...(projectFilters?.mrnti.length ? projectFilters.mrnti : [...new Set(projectsData.map((item) => item.mrnti))])],
		[projectFilters?.mrnti, projectsData],
	);
	const statusOptions = useMemo(
		() => ['all', ...(projectFilters?.status.length ? projectFilters.status : Object.keys(statusLabels))],
		[projectFilters?.status, statusLabels],
	);
	const hasRealTrlData = Boolean(projectFilters?.trl.length);
	const trlOptions = useMemo<(TrlLevel | 'all')[]>(() => {
		if (projectFilters?.trl.length) {
			const parsed = projectFilters.trl
				.map((value) => Number(String(value).replace(/[^\d]/g, '')))
				.filter((value) => value >= 3 && value <= 9) as TrlLevel[];
			return ['all', ...new Set(parsed)];
		}
		return ['all'];
	}, [projectFilters?.trl]);
	const dropdownOptions = useMemo<Record<DropdownFilterKey, OptionItem[]>>(() => {
		const toCountMap = (countList?: Array<{ value: string; count: number }>): Map<string, number> =>
			new Map((countList ?? []).map((item) => [item.value, item.count]));

		const irnCountMap = toCountMap(projectFiltersMeta?.irn);
		const applicantCountMap = toCountMap(projectFiltersMeta?.applicant);
		const mrntiCountMap = toCountMap(projectFiltersMeta?.mrnti);
		const financingTypeCountMap = toCountMap(projectFiltersMeta?.financingType);

		const withCount = (value: string, label: string, countMap?: Map<string, number>): string => {
			const count = countMap?.get(value);
			return count !== undefined ? `${label} (${count})` : label;
		};

		const buildOptions = (
			options: string[],
			allLabel: string,
			countMap?: Map<string, number>,
			labelResolver: (value: string) => string = (value) => value,
		): OptionItem[] =>
			options.map((value) => ({
				value,
				label: value === 'all' ? allLabel : withCount(value, labelResolver(value), countMap),
			}));

		return {
			irn: buildOptions(irnOptions, t('projects_filter_irn'), irnCountMap),
			applicant: buildOptions(applicantOptions, t('projects_filter_applicant'), applicantCountMap),
			customer: buildOptions(customerOptions, t('projects_filter_customer')),
			mrnti: buildOptions(mrntiOptions, t('projects_filter_mrnti'), mrntiCountMap),
			financingType: buildOptions(
				financingTypeOptions,
				t('projects_filter_financing_type'),
				financingTypeCountMap,
				(value) => financingLabels[value] ?? value,
			),
		};
	}, [applicantOptions, customerOptions, financingLabels, financingTypeOptions, irnOptions, mrntiOptions, projectFiltersMeta, t]);
	const projectAvailableCounts = useMemo(
		() => ({
			region: regions.length,
			irn: Math.max(irnOptions.length - 1, 0),
			financingType: Math.max(dropdownOptions.financingType.length - 1, 0),
			priority: Math.max(priorityOptions.length - 1, 0),
			contest: Math.max(contestOptions.length - 1, 0),
			applicant: Math.max(applicantOptions.length - 1, 0),
			customer: Math.max(customerOptions.length - 1, 0),
			mrnti: Math.max(mrntiOptions.length - 1, 0),
			status: Math.max(statusOptions.length - 1, 0),
			trl: trlOptions.filter((option) => option !== 'all').length,
		}),
		[
			regions.length,
			irnOptions.length,
			dropdownOptions.financingType.length,
			priorityOptions.length,
			contestOptions.length,
			applicantOptions.length,
			customerOptions.length,
			mrntiOptions.length,
			statusOptions.length,
			trlOptions,
		],
	);

	const activeColumns = useMemo(
		() => columnDefinitionsLocal.filter((column) => visibleColumns[column.key]),
		[visibleColumns, columnDefinitionsLocal],
	);

	const handleSort = (key: keyof Project) => {
		setSort((prev) => {
			if (prev.key === key) {
				const direction = prev.direction === 'asc' ? 'desc' : 'asc';
				return { key, direction };
			}
			return { key, direction: 'asc' };
		});
	};

	const toggleColumn = (columnKey: ColumnKey) => {
		setVisibleColumns((prev) => {
			const currentlyVisible = Object.values(prev).filter(Boolean).length;
			const nextValue = !prev[columnKey];
			if (!nextValue && currentlyVisible === 1) {
				return prev;
			}
			return { ...prev, [columnKey]: nextValue };
		});
	};

	useEffect(() => {
		if (!isColumnPickerOpen) {
			return;
		}

		const handleClick = (event: MouseEvent) => {
			if (columnPickerRef.current && !columnPickerRef.current.contains(event.target as Node)) {
				setIsColumnPickerOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClick);
		return () => document.removeEventListener('mousedown', handleClick);
	}, [isColumnPickerOpen]);

	useEffect(() => {
		setCurrentPage(1);
	}, [appliedFilters, selectedRegionId]);

	useEffect(() => {
		if (pageMeta.totalPages > 0 && currentPage > pageMeta.totalPages) {
			setCurrentPage(pageMeta.totalPages);
		}
	}, [currentPage, pageMeta.totalPages]);

	useEffect(() => {
		if (!openDropdown) {
			return;
		}

		const handleClickOutside = (event: MouseEvent) => {
			const dropdownNode = dropdownRefs.current[openDropdown];
			if (dropdownNode && !dropdownNode.contains(event.target as Node)) {
				setOpenDropdown(null);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [openDropdown]);

	useEffect(() => {
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setOpenDropdown(null);
			}
		};

		window.addEventListener('keydown', handleEscape);
		return () => window.removeEventListener('keydown', handleEscape);
	}, []);

	const percentage = (value: number) =>
		((value - YEAR_RANGE.min) / (YEAR_RANGE.max - YEAR_RANGE.min)) * 100;

	const rangeBackgroundStyle = useMemo<React.CSSProperties>(
		() =>
			({
				'--range-start': `${percentage(filters.startYear)}%`,
				'--range-end': `${percentage(filters.endYear)}%`,
			} as React.CSSProperties),
		[filters.endYear, filters.startYear],
	);

	const renderCompactText = (value: string, className = 'projects-cell-ellipsis') => (
		<span className={className} title={value}>
			{value}
		</span>
	);

	const renderCellContent = (columnKey: ColumnKey, project: Project): React.ReactNode => {
		switch (columnKey) {
			case 'irn':
				return renderCompactText(project.irn);
			case 'title':
				return renderCompactText(project.title);
			case 'applicant':
				return renderCompactText(project.applicant);
			case 'priority':
				return renderCompactText(priorityLabels[project.priority] ?? project.priority);
			case 'financingType':
				return renderCompactText(financingLabels[project.financingType] ?? project.financingType);
			case 'financingTotal':
				return formatCurrency(project.financingTotal);
			case 'region':
				return renderCompactText(regionNameById[project.regionId] ?? '—');
			case 'status':
				return renderCompactText(statusLabels[project.status] ?? project.status);
			case 'period':
				return `${project.startYear}-${project.endYear}`;
			default:
				return null;
		}
	};

	const getCellText = (columnKey: ColumnKey, project: Project): string => {
		switch (columnKey) {
			case 'irn':
				return project.irn;
			case 'title':
				return project.title;
			case 'applicant':
				return project.applicant;
			case 'priority':
				return priorityLabels[project.priority] ?? project.priority;
			case 'financingType':
				return financingLabels[project.financingType] ?? project.financingType;
			case 'financingTotal':
				return formatCurrency(project.financingTotal);
			case 'region':
				return regionNameById[project.regionId] ?? '—';
			case 'status':
				return statusLabels[project.status] ?? project.status;
			case 'period':
				return `${project.startYear}-${project.endYear}`;
			default:
				return '';
		}
	};

	const handleExportReport = async () => {
		if (isExporting) {
			return;
		}

		setIsExporting(true);
		try {
			const exportLimit = Math.min(Math.max(pageMeta.total, 1), 10000);
			const response = await projectsApi.list({
				irn: appliedFilters.irn === 'all' ? undefined : appliedFilters.irn,
				q: appliedFilters.search || undefined,
				region: selectedRegionId === 'national' ? undefined : (regionNameById[selectedRegionId] ?? undefined),
				financingType: appliedFilters.financingType === 'all' ? undefined : appliedFilters.financingType,
				priority: appliedFilters.priority === 'all' ? undefined : appliedFilters.priority,
				applicant: appliedFilters.applicant === 'all' ? undefined : appliedFilters.applicant,
				status: appliedFilters.status === 'all' ? undefined : appliedFilters.status,
				contest: appliedFilters.contest === 'all' ? undefined : appliedFilters.contest,
				customer: appliedFilters.customer === 'all' ? undefined : appliedFilters.customer,
				mrnti: appliedFilters.mrnti === 'all' ? undefined : appliedFilters.mrnti,
				trl: appliedFilters.trl === 'all' ? undefined : appliedFilters.trl,
				startYear: appliedFilters.startYear,
				endYear: appliedFilters.endYear,
				page: 1,
				limit: exportLimit,
			});

			const exportedProjects = response.items.map(toProject);
			const regionLabel =
				selectedRegionId === 'national'
					? t('projects_filter_region_all')
					: (regionNameById[selectedRegionId] ?? t('projects_filter_region_all'));

			await exportPdfReport({
				title: 'Отчёт по проектам',
				fileNamePrefix: 'projects-report',
				subtitleLines: [
					`Регион: ${regionLabel}`,
					`Период: ${appliedFilters.startYear}–${appliedFilters.endYear}`,
					`Найдено проектов: ${response.meta.total}`,
					`Сформировано: ${new Date().toLocaleString('ru-RU')}`,
				],
				columns: activeColumns.map((column) => ({ key: column.key, label: column.label })),
				rows: exportedProjects.map((project) => activeColumns.map((column) => getCellText(column.key, project))),
			});
		} catch (error) {
			console.error('Не удалось сформировать отчёт по проектам', error);
		} finally {
			setIsExporting(false);
		}
	};

	const handleYearChange = (key: 'startYear' | 'endYear', value: number) => {
		setFilters((prev) => {
			const next = { ...prev, [key]: value };
			if (next.startYear > next.endYear) {
				if (key === 'startYear') {
					next.endYear = next.startYear;
				} else {
					next.startYear = next.endYear;
				}
			}
			return next;
		});
	};

	const handleFilterChange = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
		setFilters((prev) => ({ ...prev, [key]: value }));
	};

	const setDropdownRef = (key: DropdownFilterKey, node: HTMLDivElement | null) => {
		if (node) {
			dropdownRefs.current[key] = node;
		} else {
			delete dropdownRefs.current[key];
		}
	};

	const handleDropdownToggle = (key: DropdownFilterKey) => {
		setOpenDropdown((prev) => {
			const next = prev === key ? null : key;
			if (next) {
				setDropdownSearch((prevSearch) => ({ ...prevSearch, [key]: '' }));
			}
			return next;
		});
	};

	const handleDropdownSelect = (key: DropdownFilterKey, value: string) => {
		switch (key) {
			case 'financingType':
				handleFilterChange('financingType', value as FilterState['financingType']);
				break;
			case 'irn':
				handleFilterChange('irn', value);
				break;
			case 'applicant':
				handleFilterChange('applicant', value);
				break;
			case 'customer':
				handleFilterChange('customer', value);
				break;
			case 'mrnti':
			default:
				handleFilterChange('mrnti', value);
				break;
		}
		setOpenDropdown(null);
	};

	const handleDropdownSearchChange = (key: DropdownFilterKey, value: string) => {
		setDropdownSearch((prev) => ({ ...prev, [key]: value }));
	};

	const resetFilters = () => {
		setFilters(DEFAULT_FILTERS);
		setAppliedFilters(DEFAULT_FILTERS);
		setSelectedRegionId('national');
	};

	const applyFilters = () => {
		setAppliedFilters(filters);
		setCurrentPage(1);
	};

	const visibleProjects = useMemo(() => {
		let list = [...projectsData];

		if (sort.key && sort.direction) {
			const key = sort.key;
			list = [...list].sort((a, b) => {
				const aValue = a[key];
				const bValue = b[key];

				if (typeof aValue === 'number' && typeof bValue === 'number') {
					return sort.direction === 'asc' ? aValue - bValue : bValue - aValue;
				}

				return sort.direction === 'asc'
					? String(aValue).localeCompare(String(bValue))
					: String(bValue).localeCompare(String(aValue));
			});
		}

		return list;
	}, [sort, projectsData]);

	const totalPages = Math.max(pageMeta.totalPages, 1);
	const isDataPending = !hasLoaded && isLoading;
	const isRefreshing = hasLoaded && isLoading;
	const tableSkeletonRows = 6;

	return (
		<div className="projects-page">
			<header className="projects-header">
				<div>
					<h1>{t('projects_page_header')}</h1>
					<p>{t('projects_found_count')}{pageMeta.total}</p>
					{loadError && <p className="projects-load-error">{loadError}</p>}
				</div>
				<div className="projects-header-actions">
				<button type="button" className="projects-header-button" onClick={handleExportReport} disabled={isExporting}>
					<Download size={18} />
					{isExporting ? t('projects_export_report_pending') : t('projects_export_report')}
				</button>
				</div>
			</header>

			<div className="projects-search-line">
				<div className="projects-search-toolbar">
				<div className="projects-search">
					<Search size={18} />
					<input
						type="text"
						placeholder={t('projects_search_placeholder')}
						value={filters.search}
							onChange={(event) => handleFilterChange('search', event.target.value)}
						/>
					</div>
					<button type="button" className="projects-primary-button" onClick={applyFilters}>
						Поиск
					</button>
					<div className="projects-column-picker" ref={columnPickerRef}>
					<button
						type="button"
						className="projects-column-button"
						onClick={() => setIsColumnPickerOpen((prev) => !prev)}
					>
						<SlidersHorizontal size={16} />
						<span>{t('projects_customize_columns')}</span>
					</button>
					{isColumnPickerOpen && (
						<div className="projects-column-list">
							{columnDefinitionsLocal.map((column) => (
									<label key={column.key} className="projects-column-option">
										<input
											type="checkbox"
											checked={visibleColumns[column.key]}
											onChange={() => toggleColumn(column.key)}
										/>
										<span>{column.label}</span>
									</label>
								))}
							</div>
						)}
					</div>
				</div>
			</div>

			{isDataPending ? (
				<PageLoader />
			) : (
			<div className="projects-content">
				<aside className="projects-sidebar">
					<div className="projects-filter-block">
						<div className="projects-filter-title">{t('projects_filter_region_title')}</div>
						<div className="projects-filter-item">
							<select
								id="projects-region"
								value={selectedRegionId}
								onChange={(event) => setSelectedRegionId(event.target.value as RegionId)}
							>
								<option value="national">{t('projects_filter_region_label')}</option>
								{regions.map((region) => (
									<option key={region.id} value={region.id}>
										{region.name}
									</option>
								))}
							</select>
						</div>
					</div>

					<div className="projects-filter-block">
						<div className="projects-filter-title">{t('projects_filter_period_title')}</div>
						<div className="period-range-slider" style={rangeBackgroundStyle}>
							<div className="period-range-values">
								<span className="period-range-value">{filters.startYear}</span>
								<span className="period-range-value">{filters.endYear}</span>
							</div>
							<div className="period-range-track" />
							<div className="period-range-inputs">
								<input
									type="range"
									min={YEAR_RANGE.min}
									max={YEAR_RANGE.max}
									value={filters.startYear}
									onChange={(event) => handleYearChange('startYear', Number(event.target.value))}
									className="period-range-thumb"
								/>
								<input
									type="range"
									min={YEAR_RANGE.min}
									max={YEAR_RANGE.max}
									value={filters.endYear}
									onChange={(event) => handleYearChange('endYear', Number(event.target.value))}
									className="period-range-thumb period-range-thumb--upper"
								/>
							</div>
						</div>
					</div>

					<div className="projects-filter-block">
						<div className="projects-filter-title">{t('projects_filter_filters_title')}</div>
						<div className="projects-filters-grid">
							<div className="projects-filter-item">
								<label htmlFor="filter-irn">
									{t('projects_label_irn')}
									<span className="projects-filter-badge">доступно {projectAvailableCounts.irn}</span>
								</label>
								<SearchableSelect
									id="filter-irn"
									label={t('projects_label_irn')}
									placeholder={t('projects_placeholder_irn')}
									options={dropdownOptions.irn}
									value={filters.irn}
									isOpen={openDropdown === 'irn'}
									searchValue={dropdownSearch.irn}
									onToggle={() => handleDropdownToggle('irn')}
									onSelect={(value) => handleDropdownSelect('irn', value)}
									onSearchChange={(value) => handleDropdownSearchChange('irn', value)}
									setRef={(node) => setDropdownRef('irn', node)}
								/>
							</div>

							<div className="projects-filter-item">
								<label htmlFor="filter-financing">
									{t('projects_label_financing_type')}
									<span className="projects-filter-badge">доступно {projectAvailableCounts.financingType}</span>
								</label>
								<SearchableSelect
									id="filter-financing"
									label={t('projects_label_financing_type')}
									placeholder={t('projects_placeholder_financing_type')}
									options={dropdownOptions.financingType}
									value={filters.financingType}
									isOpen={openDropdown === 'financingType'}
									searchValue={dropdownSearch.financingType}
									onToggle={() => handleDropdownToggle('financingType')}
									onSelect={(value) => handleDropdownSelect('financingType', value)}
									onSearchChange={(value) => handleDropdownSearchChange('financingType', value)}
									setRef={(node) => setDropdownRef('financingType', node)}
								/>
							</div>

							<div className="projects-filter-item">
								<label htmlFor="filter-priority">
									{t('projects_label_priority')}
									<span className="projects-filter-badge">доступно {projectAvailableCounts.priority}</span>
								</label>
								<select
									id="filter-priority"
									value={filters.priority}
									onChange={(event) => handleFilterChange('priority', event.target.value)}
								>
									{priorityOptions.map((priority) => (
										<option key={priority} value={priority}>
											{priority === 'all' ? t('projects_option_all_priorities') : (priorityLabels[priority] ?? priority)}
										</option>
									))}
								</select>
							</div>

							<div className="projects-filter-item">
								<label htmlFor="filter-contest">
									{t('projects_label_contest')}
									<span className="projects-filter-badge">доступно {projectAvailableCounts.contest}</span>
								</label>
								<select
									id="filter-contest"
									value={filters.contest}
									onChange={(event) => handleFilterChange('contest', event.target.value)}
								>
									{contestOptions.map((option) => (
										<option key={option} value={option}>
											{option === 'all' ? t('projects_option_all_contests') : option}
										</option>
									))}
								</select>
							</div>

							<div className="projects-filter-item">
								<label htmlFor="filter-applicant">
									{t('projects_label_applicant')}
									<span className="projects-filter-badge">доступно {projectAvailableCounts.applicant}</span>
								</label>
								<SearchableSelect
									id="filter-applicant"
									label={t('projects_label_applicant')}
									placeholder={t('projects_placeholder_applicant')}
									options={dropdownOptions.applicant}
									value={filters.applicant}
									isOpen={openDropdown === 'applicant'}
									searchValue={dropdownSearch.applicant}
									onToggle={() => handleDropdownToggle('applicant')}
									onSelect={(value) => handleDropdownSelect('applicant', value)}
									onSearchChange={(value) => handleDropdownSearchChange('applicant', value)}
									setRef={(node) => setDropdownRef('applicant', node)}
								/>
							</div>

							<div className="projects-filter-item">
								<label htmlFor="filter-customer">
									{t('projects_label_customer')}
									<span className="projects-filter-badge">доступно {projectAvailableCounts.customer}</span>
								</label>
								<SearchableSelect
									id="filter-customer"
									label={t('projects_label_customer')}
									placeholder={t('projects_placeholder_customer')}
									options={dropdownOptions.customer}
									value={filters.customer}
									isOpen={openDropdown === 'customer'}
									searchValue={dropdownSearch.customer}
									onToggle={() => handleDropdownToggle('customer')}
									onSelect={(value) => handleDropdownSelect('customer', value)}
									onSearchChange={(value) => handleDropdownSearchChange('customer', value)}
									setRef={(node) => setDropdownRef('customer', node)}
								/>
							</div>

							<div className="projects-filter-item">
								<label htmlFor="filter-mrnti">
									{t('projects_label_mrnti')}
									<span className="projects-filter-badge">доступно {projectAvailableCounts.mrnti}</span>
								</label>
								<SearchableSelect
									id="filter-mrnti"
									label={t('projects_label_mrnti')}
									placeholder={t('projects_placeholder_mrnti')}
									options={dropdownOptions.mrnti}
									value={filters.mrnti}
									isOpen={openDropdown === 'mrnti'}
									searchValue={dropdownSearch.mrnti}
									onToggle={() => handleDropdownToggle('mrnti')}
									onSelect={(value) => handleDropdownSelect('mrnti', value)}
									onSearchChange={(value) => handleDropdownSearchChange('mrnti', value)}
									setRef={(node) => setDropdownRef('mrnti', node)}
								/>
							</div>

							<div className="projects-filter-item">
								<label htmlFor="filter-status">
									{t('projects_label_status')}
									<span className="projects-filter-badge">доступно {projectAvailableCounts.status}</span>
								</label>
								<select
									id="filter-status"
									value={filters.status}
									onChange={(event) => handleFilterChange('status', event.target.value)}
								>
									{statusOptions.map((status) => (
										<option key={status} value={status}>
											{status === 'all' ? t('projects_option_all_statuses') : (statusLabels[status] ?? status)}
										</option>
									))}
								</select>
							</div>

							{hasRealTrlData && (
								<div className="projects-filter-item">
									<label htmlFor="filter-trl">
										{t('projects_label_trl')}
										<span className="projects-filter-badge">доступно {projectAvailableCounts.trl}</span>
									</label>
									<select
										id="filter-trl"
										value={filters.trl}
										onChange={(event) => {
											const value = event.target.value === 'all'
												? 'all'
												: (Number(event.target.value) as TrlLevel);
											handleFilterChange('trl', value);
										}}
									>
										{trlOptions.map((option) => (
											<option key={option} value={option}>
												{option === 'all' ? t('projects_option_all_trl') : `TRL ${option}`}
											</option>
										))}
									</select>
								</div>
							)}
						</div>
					</div>

				<div className="projects-filter-actions">
					<button type="button" className="projects-primary-button" onClick={applyFilters}>
						Применить
					</button>
					<button type="button" className="projects-header-button projects-reset-button" onClick={resetFilters}>
						{t('projects_button_reset_filters')}
					</button>
				</div>
				</aside>

				<main className="projects-main">
					<section className="projects-table-section">
						<div className="projects-table-wrapper">
							<table className="projects-table">
								<thead>
									<tr>
										{activeColumns.map((column) => {
											if (column.sortKey) {
												const headerState = sort.key === column.sortKey ? sort.direction : undefined;
												return (
													<th
														key={column.key}
														onClick={() => handleSort(column.sortKey!)}
														className={`${headerState ?? ''} projects-col projects-col--${column.key}`.trim()}
													>
														{column.label}
														<ArrowUpDown size={14} />
													</th>
												);
											}
											return (
												<th key={column.key} className={`projects-col projects-col--${column.key}`}>
													{column.label}
												</th>
											);
										})}
									</tr>
								</thead>
								<tbody>
									{isRefreshing
										? Array.from({ length: tableSkeletonRows }).map((_, rowIndex) => (
											<tr key={`projects-skeleton-${rowIndex}`} className="projects-skeleton-row">
												{activeColumns.map((column) => (
													<td
														key={`projects-skeleton-${rowIndex}-${column.key}`}
														className={`projects-cell projects-cell--${column.key}`}
													>
														<span className="projects-skeleton-cell" aria-hidden="true" />
													</td>
												))}
											</tr>
										))
										: visibleProjects.map((project) => (
											<tr key={project.id}>
												{activeColumns.map((column) => (
													<td
														key={`${project.id}-${column.key}`}
														className={`projects-cell projects-cell--${column.key}`}
													>
														{renderCellContent(column.key, project)}
													</td>
												))}
											</tr>
										))}
								</tbody>
							</table>
							{!isRefreshing && visibleProjects.length === 0 && (
								<div className="no-results">{t('projects_not_found')}</div>
							)}
						</div>
						<p className="projects-summary">
							{t('projects_shown')} {visibleProjects.length} {t('projects_from_total')} {pageMeta.total}
						</p>
						<div className="projects-pagination">
							<button
								type="button"
								onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
								disabled={!pageMeta.hasPrevPage || isLoading}
							>
								Назад
							</button>
							<span>
								Страница {pageMeta.page} из {totalPages}
							</span>
							<button
								type="button"
								onClick={() => setCurrentPage((prev) => prev + 1)}
								disabled={!pageMeta.hasNextPage || isLoading}
							>
								Вперёд
							</button>
						</div>
					</section>
				</main>
			</div>
			)}
		</div>
	);
};

export default ProjectsPage;
