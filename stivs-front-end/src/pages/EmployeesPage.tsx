import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Search, ArrowUpDown, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRegionContext } from '../context/RegionContext';
import type { RegionId } from '../context/RegionContext'; 
import './EmployeesPage.css';
import { useTranslation } from 'react-i18next';
import { employeesApi, mapRegionToId, resolveRegionLabel } from '../api/services';
import type { BackendEmployee } from '../api/types';
import { H_INDEX_RANGE_BY_GROUP, useEmployeesData } from '../hooks/useEmployeesData';
import PageLoader from '../components/PageLoader/PageLoader';
import { exportPdfReport } from '../utils/exportPdfReport';

// --- 1. Типы данных и мок-данные ---
// Значения этих полей приходят с backend как произвольные строки (реальные данные из БД),
// поэтому типы — строки, а не фиксированные наборы вариантов.
export type AffiliateType = string;
export type GenderType = string;
export type CitizenshipType = string;
export type DegreeType = string;
export type HIndexGroup = '0-1' | '2-5' | '6-10' | '10+' | 'all';
export type MRNTIType = string;
export type ClassifierType = string;

interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  regionId: RegionId;
  regionLabel?: string;
  hireDate: string;
  email: string;
  birthYear: number;
  affiliateType: AffiliateType;
  // НОВЫЕ ПОЛЯ
  gender: GenderType;
  degree: DegreeType;
  citizenship: CitizenshipType;
  projectRole: string; // Роль в проекте (напр., "Руководитель", "Исполнитель")
  hIndex: number;
  mrntiCode: MRNTIType;
  classifier: ClassifierType;
  scopusAuthorId: string; // Author ID в Scopus
  hIndexScopus?: number;
  researcherIdWos: string; // Researcher ID Web of Science
}

// --- 2. Определение значений фильтров и типов ---
const currentYear = new Date().getFullYear();
// Устанавливаем минимальные и максимальные границы для фильтра возраста (20 - 80)
const MIN_AGE_LIMIT = 20; 
const MAX_AGE_LIMIT = 80;
const PAGE_LIMIT = 20;


interface EmployeeFilters {
  searchTerm: string;
  position: string;
  department: string;
  minAge: number;
  maxAge: number;
  affiliateType: AffiliateType;
  // НОВЫЕ ФИЛЬТРЫ
  gender: GenderType | 'all';
  degree: DegreeType | 'all';
  citizenship: CitizenshipType | 'all';
  projectRole: string;
  hIndexGroup: HIndexGroup | 'all';
  mrnti: MRNTIType;
  classifier: ClassifierType;
  regionId: RegionId | 'all';
}

interface SortState {
  key: keyof Employee | '';
  direction: 'asc' | 'desc' | '';
}

type EmployeeColumnKey =
  | 'name'
  | 'position'
  | 'degree'
  | 'scopusAuthorId'
  | 'hIndexScopus'
  | 'researcherIdWos'
  | 'hIndex'
  | 'region'
  | 'age';

interface EmployeeColumnDefinition {
  key: EmployeeColumnKey;
  label: string;
  sortKey?: keyof Employee | 'age';
}

const employeeColumnDefinitions: EmployeeColumnDefinition[] = [
  { key: 'name', label: 'ФИО', sortKey: 'name' },
  { key: 'position', label: 'Ученое звание', sortKey: 'position' },
  { key: 'degree', label: 'Ученая степень', sortKey: 'degree' },
  { key: 'scopusAuthorId', label: 'AUTHOR ID В SCOPUS' },
  { key: 'hIndexScopus', label: 'H-индекс Scopus', sortKey: 'hIndex' },
  { key: 'researcherIdWos', label: 'RESEARCHER ID WEB OF SCIENCE' },
  { key: 'hIndex', label: 'H-индекс WoS', sortKey: 'hIndex' },
  { key: 'region', label: 'Регион' },
  { key: 'age', label: 'Возраст', sortKey: 'age' },
];

const defaultVisibleEmployeeColumns: Record<EmployeeColumnKey, boolean> = employeeColumnDefinitions.reduce(
  (acc, column) => ({
    ...acc,
    [column.key]: true,
  }),
  {} as Record<EmployeeColumnKey, boolean>,
);

const initiallyHiddenColumns: EmployeeColumnKey[] = ['position', 'hIndexScopus', 'hIndex', 'age'];

const initialVisibleEmployeeColumns: Record<EmployeeColumnKey, boolean> = {
  ...defaultVisibleEmployeeColumns,
  ...initiallyHiddenColumns.reduce(
    (acc, key) => ({ ...acc, [key]: false }),
    {} as Record<EmployeeColumnKey, boolean>,
  ),
};

const createInitialFilters = (): EmployeeFilters => ({
  searchTerm: '',
  position: 'all',
  department: 'all',
  minAge: MIN_AGE_LIMIT,
  maxAge: MAX_AGE_LIMIT,
  affiliateType: 'all',
  gender: 'all',
  degree: 'all',
  citizenship: 'all',
  projectRole: 'all',
  hIndexGroup: 'all',
  mrnti: 'all',
  classifier: 'all',
  regionId: 'all',
});

const asStringMetric = (value: unknown, fallback = 'all'): string => (typeof value === 'string' && value ? value : fallback);

const toEmployee = (item: BackendEmployee): Employee => {
  const metrics = item.metrics ?? {};
  const hIndexRaw = metrics.hIndex;
  const hIndex = typeof hIndexRaw === 'number' ? hIndexRaw : Number(hIndexRaw ?? 0);
  const researcherIdWosRaw = metrics.researcherIdWos;
  const researcherIdWos = typeof researcherIdWosRaw === 'string' ? researcherIdWosRaw : '';
  const scopusRaw = metrics.scopusAuthorId;
  const scopusAuthorId = typeof scopusRaw === 'string' ? scopusRaw : '';
  const hIndexScopusRaw = metrics.hIndexScopus;
  const hIndexScopus = typeof hIndexScopusRaw === 'number'
    ? hIndexScopusRaw
    : Number(hIndexScopusRaw ?? hIndex);
  const ageRaw = metrics.age;
  const age = typeof ageRaw === 'number' ? ageRaw : Number(ageRaw ?? 0);
  const birthYear = age > 0 ? currentYear - age : 1990;

  return {
    id: item.id,
    name: item.name,
    position: item.position,
    department: item.department || '—',
    regionId: mapRegionToId(item.region) as RegionId,
    regionLabel: resolveRegionLabel(item.region),
    hireDate: new Date().toISOString().slice(0, 10),
    email: item.email,
    birthYear,
    affiliateType: asStringMetric(metrics.affiliateType),
    gender: asStringMetric(metrics.gender),
    degree: asStringMetric(metrics.academicDegree, 'none'),
    citizenship: asStringMetric(metrics.citizenship),
    projectRole: asStringMetric(metrics.projectRole),
    hIndex: Number.isFinite(hIndex) ? hIndex : 0,
    hIndexScopus: Number.isFinite(hIndexScopus) ? hIndexScopus : Number.isFinite(hIndex) ? hIndex : 0,
    mrntiCode: asStringMetric(metrics.mrnti),
    classifier: asStringMetric(metrics.classifier),
    scopusAuthorId: scopusAuthorId || '-',
    researcherIdWos: researcherIdWos || '-',
  };
};

// --- 3. Компонент страницы ---
const EmployeesPage: React.FC = () => {
  const { selectedRegionId, regions } = useRegionContext();
  const { t } = useTranslation(); 
  const [currentPage, setCurrentPage] = useState(1);
  
  const [filters, setFilters] = useState<EmployeeFilters>(() => createInitialFilters());
  const [appliedFilters, setAppliedFilters] = useState<EmployeeFilters>(() => createInitialFilters());
  
  const [sort, setSort] = useState<SortState>({ key: 'name', direction: 'asc' });
  const [visibleColumns, setVisibleColumns] = useState<Record<EmployeeColumnKey, boolean>>(() => ({
    ...initialVisibleEmployeeColumns,
  }));
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement | null>(null);

  const regionNameById = useMemo(() => {
    const map: Record<string, string> = {};
    regions.forEach((region) => {
      map[region.id] = region.name;
    });
    return map;
  }, [regions]);

  const {
    employeesData,
    isLoading,
    hasLoaded,
    loadError,
    employeeFilters,
    employeeFiltersMeta,
    pageMeta,
  } = useEmployeesData({
    filters: appliedFilters,
    selectedRegionId,
    regionNameById,
    currentPage,
    pageLimit: PAGE_LIMIT,
    fallbackItems: [],
    mapItem: toEmployee,
  });

  const activeColumns = useMemo(
    () => employeeColumnDefinitions.filter((column) => visibleColumns[column.key]),
    [visibleColumns],
  );

  const allPositions = useMemo(
    () =>
      employeeFilters?.position.length
        ? employeeFilters.position
        : Array.from(new Set(employeesData.map((employee) => employee.position))).sort(),
    [employeeFilters?.position, employeesData],
  );

  const allDegrees = useMemo(
    () => (employeeFilters?.degree.length ? employeeFilters.degree : ['doctor', 'candidate', 'phd', 'master', 'none']),
    [employeeFilters?.degree],
  );
  const allGenders = useMemo(
    () => (employeeFilters?.gender.length ? employeeFilters.gender : ['male', 'female']),
    [employeeFilters?.gender],
  );
  const allAffiliateTypes = useMemo(
    () => (employeeFilters?.affiliateType.length ? employeeFilters.affiliateType : ['staff', 'external']),
    [employeeFilters?.affiliateType],
  );
  const allCitizenships = useMemo(
    () => (employeeFilters?.citizenship.length ? employeeFilters.citizenship : ['resident', 'non-resident']),
    [employeeFilters?.citizenship],
  );
  const allHIndexGroups = useMemo(
    () => (employeeFilters?.hIndexGroup.length ? employeeFilters.hIndexGroup : ['0-1', '2-5', '6-10', '10+']),
    [employeeFilters?.hIndexGroup],
  );
  const allMrntiCodes = useMemo(
    () => (employeeFilters?.mrnti.length ? employeeFilters.mrnti : ['11.00.00', '27.00.00', '55.00.00']),
    [employeeFilters?.mrnti],
  );
  const degreeCountByValue = useMemo(
    () => new Map((employeeFiltersMeta?.degree ?? []).map((item) => [item.value, item.count])),
    [employeeFiltersMeta?.degree],
  );
  const departmentCountByValue = useMemo(
    () => new Map((employeeFiltersMeta?.department ?? []).map((item) => [item.value, item.count])),
    [employeeFiltersMeta?.department],
  );
  const projectRoleCountByValue = useMemo(
    () => new Map((employeeFiltersMeta?.projectRole ?? []).map((item) => [item.value, item.count])),
    [employeeFiltersMeta?.projectRole],
  );
  const genderCountByValue = useMemo(
    () => new Map((employeeFiltersMeta?.gender ?? []).map((item) => [item.value, item.count])),
    [employeeFiltersMeta?.gender],
  );
  const affiliateCountByValue = useMemo(
    () => new Map((employeeFiltersMeta?.affiliateType ?? []).map((item) => [item.value, item.count])),
    [employeeFiltersMeta?.affiliateType],
  );
  const citizenshipCountByValue = useMemo(
    () => new Map((employeeFiltersMeta?.citizenship ?? []).map((item) => [item.value, item.count])),
    [employeeFiltersMeta?.citizenship],
  );
  const hIndexGroupCountByValue = useMemo(
    () => new Map((employeeFiltersMeta?.hIndexGroup ?? []).map((item) => [item.value, item.count])),
    [employeeFiltersMeta?.hIndexGroup],
  );
  const mrntiCountByValue = useMemo(
    () => new Map((employeeFiltersMeta?.mrnti ?? []).map((item) => [item.value, item.count])),
    [employeeFiltersMeta?.mrnti],
  );

  const allProjectRoles = useMemo(
    () => (employeeFilters?.projectRole.length
      ? employeeFilters.projectRole
      : Array.from(new Set(employeesData.map((employee) => employee.projectRole))).sort()),
    [employeeFilters?.projectRole, employeesData],
  );

  const allDepartments = useMemo(
    () => (employeeFilters?.department.length
      ? employeeFilters.department
      : Array.from(new Set(employeesData.map((employee) => employee.department))).sort()),
    [employeeFilters?.department, employeesData],
  );
  const employeesAvailableCounts = useMemo(
    () => ({
      gender: allGenders.length,
      affiliate: allAffiliateTypes.length,
      citizenship: allCitizenships.length,
      region: employeeFilters?.region.length || regions.length,
      degree: allDegrees.length,
      position: allPositions.length,
      department: allDepartments.length,
      projectRole: allProjectRoles.length,
      mrnti: allMrntiCodes.length,
      classifier: 3,
      hIndex: allHIndexGroups.length,
    }),
    [
      allAffiliateTypes.length,
      allCitizenships.length,
      allDegrees.length,
      allDepartments.length,
      allGenders.length,
      allHIndexGroups.length,
      allMrntiCodes.length,
      allPositions.length,
      allProjectRoles.length,
      employeeFilters?.region.length,
      regions.length,
    ],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters.degree, appliedFilters.hIndexGroup, appliedFilters.position, appliedFilters.searchTerm, selectedRegionId]);

  useEffect(() => {
    if (pageMeta.totalPages > 0 && currentPage > pageMeta.totalPages) {
      setCurrentPage(pageMeta.totalPages);
    }
  }, [currentPage, pageMeta.totalPages]);

  // Универсальный обработчик для текстовых и селектов
  const handleFilterChange = (name: keyof EmployeeFilters, value: string | AffiliateType | GenderType | CitizenshipType | DegreeType | HIndexGroup) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  
  const resetFilters = () => {
    const initial = createInitialFilters();
    setFilters(initial);
    setAppliedFilters(initial);
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
    setCurrentPage(1);
  };
  
  // Обработчик для ввода возраста
  const handleAgeChange = (name: 'minAge' | 'maxAge', value: string) => {
    let numValue = parseInt(value, 10);
    
    // Если ввод пуст или нечисловой, используем крайние границы
    if (isNaN(numValue) || value === '') {
        numValue = (name === 'minAge') ? MIN_AGE_LIMIT : MAX_AGE_LIMIT;
    }

    // Проверка границ
    if (name === 'minAge') {
        numValue = Math.min(numValue, filters.maxAge);
        numValue = Math.max(numValue, MIN_AGE_LIMIT);
    }
    if (name === 'maxAge') {
        numValue = Math.max(numValue, filters.minAge);
        numValue = Math.min(numValue, MAX_AGE_LIMIT);
    }
    
    setFilters(prev => ({ ...prev, [name]: numValue }));
  };
  
  // Функция для изменения сортировки при клике на заголовок таблицы
  const handleSortChange = (key: keyof Employee | 'age') => {
      // Для возраста используем 'birthYear', но в обратном порядке сортировки
      const sortKey = key === 'age' ? 'birthYear' : key as keyof Employee;

      setSort(prev => {
          let direction: SortState['direction'] = 'asc';
          if (prev.key === sortKey) {
              direction = prev.direction === 'asc' ? 'desc' : 'asc';
          }
          
          // Чтобы сортировка была по возрастанию возраста, нужно asc по возрасту = desc по birthYear
          if (key === 'age') {
             direction = (prev.key === sortKey && prev.direction === 'desc') ? 'asc' : 'desc';
          }
          
          return { key: sortKey, direction };
      });
  };

  const toggleColumn = (columnKey: EmployeeColumnKey) => {
    setVisibleColumns((prev) => {
      const visibleCount = Object.values(prev).filter(Boolean).length;
      const nextValue = !prev[columnKey];
      if (!nextValue && visibleCount === 1) {
        return prev;
      }
      return { ...prev, [columnKey]: nextValue };
    });
  };

  useEffect(() => {
    if (!isColumnPickerOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(event.target as Node)) {
        setIsColumnPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isColumnPickerOpen]);

  const renderTruncatedText = (value: string, className = 'employee-cell-ellipsis') => (
    <span className={className} title={value}>
      {value}
    </span>
  );

  const renderEmployeeCell = (columnKey: EmployeeColumnKey, employee: Employee): React.ReactNode => {
    switch (columnKey) {
      case 'name': {
        const fullName = `${employee.name} (${employee.gender === 'male' ? t('gender_short_male') : t('gender_short_female')})`;
        return (
          <Link
            to={`/employees/profile/${employee.id}`}
            state={{ employee }}
            className="employee-cell-link employee-cell-ellipsis"
            title={fullName}
          >
            {fullName}
          </Link>
        );
      }
      case 'position':
        return renderTruncatedText(employee.position);
      case 'degree':
        return renderTruncatedText(employee.degree === 'none' ? '-' : employee.degree);
      case 'scopusAuthorId':
        return renderTruncatedText(employee.scopusAuthorId);
      case 'hIndexScopus':
        return employee.hIndexScopus ?? employee.hIndex;
      case 'researcherIdWos':
        if (!employee.researcherIdWos || employee.researcherIdWos === '-') {
          return '-';
        }
        return (
          <a
            href={employee.researcherIdWos}
            target="_blank"
            rel="noopener noreferrer"
            className="employee-cell-link employee-cell-ellipsis"
            title={employee.researcherIdWos}
          >
            {employee.researcherIdWos}
          </a>
        );
      case 'hIndex':
        return employee.hIndex;
      case 'region':
        return renderTruncatedText(
          regionNameById[employee.regionId] ?? employee.regionLabel ?? t('not_available_short'),
        );
      case 'age':
        return currentYear - employee.birthYear;
      default:
        return null;
    }
  };

  const getEmployeeCellText = (columnKey: EmployeeColumnKey, employee: Employee): string => {
    switch (columnKey) {
      case 'name':
        return `${employee.name} (${employee.gender === 'male' ? t('gender_short_male') : t('gender_short_female')})`;
      case 'position':
        return employee.position;
      case 'degree':
        return employee.degree === 'none' ? '-' : employee.degree;
      case 'scopusAuthorId':
        return employee.scopusAuthorId;
      case 'hIndexScopus':
        return String(employee.hIndexScopus ?? employee.hIndex);
      case 'researcherIdWos':
        return employee.researcherIdWos || '-';
      case 'hIndex':
        return String(employee.hIndex);
      case 'region':
        return regionNameById[employee.regionId] ?? employee.regionLabel ?? t('not_available_short');
      case 'age':
        return String(currentYear - employee.birthYear);
      default:
        return '';
    }
  };


  // --- ЛОГИКА СОРТИРОВКИ ---
  // Фильтрация (регион, подразделение, пол, гражданство, роль, степень, МРНТИ, возраст и т.д.)
  // выполняется на backend через appliedFilters — см. useEmployeesData. Здесь она не дублируется,
  // чтобы не расходиться с backend-данными.
  const filteredEmployees = useMemo(() => {
    let list = employeesData;

    // Сортировка
    if (sort.key && sort.direction) {
      list = [...list].sort((a, b) => {
        const aValue = a[sort.key as keyof Employee];
        const bValue = b[sort.key as keyof Employee];
        
        let comparison = 0;

        // Обработка числовых (hIndex, birthYear)
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } 
        // Обработка строковых (имя, должность, дата)
        else if (aValue && bValue) {
          comparison = String(aValue).localeCompare(String(bValue));
        }

        return sort.direction === 'asc' ? comparison : -comparison;
      });
    }

    return list;
  }, [sort, employeesData]);

  const handleExportReport = async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    try {
      const selectedRegionName =
        appliedFilters.regionId === 'all'
          ? (selectedRegionId === 'national' ? undefined : (regionNameById[selectedRegionId] ?? undefined))
          : (regionNameById[appliedFilters.regionId] ?? undefined);
      const hIndexRange = H_INDEX_RANGE_BY_GROUP[appliedFilters.hIndexGroup];
      const exportLimit = Math.min(Math.max(pageMeta.total, 1), 10000);

      const response = await employeesApi.list({
        page: 1,
        limit: exportLimit,
        searchTerm: appliedFilters.searchTerm || undefined,
        region: selectedRegionName,
        position: appliedFilters.position === 'all' ? undefined : appliedFilters.position,
        department: appliedFilters.department === 'all' ? undefined : appliedFilters.department,
        minAge: appliedFilters.minAge,
        maxAge: appliedFilters.maxAge,
        affiliateType: appliedFilters.affiliateType === 'all' ? undefined : appliedFilters.affiliateType,
        gender: appliedFilters.gender === 'all' ? undefined : appliedFilters.gender,
        degree: appliedFilters.degree === 'all' ? undefined : appliedFilters.degree,
        citizenship: appliedFilters.citizenship === 'all' ? undefined : appliedFilters.citizenship,
        projectRole: appliedFilters.projectRole === 'all' ? undefined : appliedFilters.projectRole,
        hIndexGroup: appliedFilters.hIndexGroup === 'all' ? undefined : appliedFilters.hIndexGroup,
        mrnti: appliedFilters.mrnti === 'all' ? undefined : appliedFilters.mrnti,
        classifier: appliedFilters.classifier === 'all' ? undefined : appliedFilters.classifier,
        minHIndex: hIndexRange.min,
        maxHIndex: hIndexRange.max,
        q: appliedFilters.searchTerm || undefined,
      });

      const exportedEmployees = response.items.map(toEmployee);
      const regionLabel = selectedRegionName ?? t('filter_option_all_regions');

      await exportPdfReport({
        title: 'Отчёт по сотрудникам',
        fileNamePrefix: 'employees-report',
        subtitleLines: [
          `Регион: ${regionLabel}`,
          `Найдено сотрудников: ${response.meta.total}`,
          `Сформировано: ${new Date().toLocaleString('ru-RU')}`,
        ],
        columns: activeColumns.map((column) => ({ key: column.key, label: column.label })),
        rows: exportedEmployees.map((employee) => activeColumns.map((column) => getEmployeeCellText(column.key, employee))),
      });
    } catch (error) {
      console.error('Не удалось сформировать отчёт по сотрудникам', error);
    } finally {
      setIsExporting(false);
    }
  };
  
  // const totalEmployeesCount = filteredEmployees.length;
  const totalPages = Math.max(pageMeta.totalPages, 1);
  const isDataPending = !hasLoaded && isLoading;
  const isRefreshing = hasLoaded && isLoading;
  const tableSkeletonRows = 6;

  return (
    <div className="employees-page">
      <header className="employees-header">
        <div>
          <h1>{t('employees_page_title')}</h1>
          <p>
            {t('projects_found_count')}{pageMeta.total}
          </p>
          {loadError && <p>{loadError}</p>}
        </div>
        <div className="employees-header-actions">
          <button
            type="button"
            className="employees-header-button"
            onClick={handleExportReport}
            disabled={isExporting}
          >
            <Download size={18} />
            {isExporting ? t('button_export_report_pending') : t('button_export_report')}
          </button>
        </div>
      </header>

      <div className="employees-search-line">
        <div className="employees-search-toolbar">
          <div className="employees-search">
            <Search size={18} />
            <input
              type="text"
              placeholder={t('search_placeholder_employees')}
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
            />
          </div>
          <button
            type="button"
            className="employees-primary-button"
            onClick={applyFilters}
          >
            Поиск
          </button>
          <div className="employees-column-picker" ref={columnPickerRef}>
            <button
              type="button"
              className="employees-column-button"
              onClick={() => setIsColumnPickerOpen((prev) => !prev)}
            >
              <SlidersHorizontal size={18} />
              {t('button_customize_columns')}
            </button>
            {isColumnPickerOpen && (
              <div className="employees-column-list">
                {employeeColumnDefinitions
                  .filter((column) => visibleColumns[column.key])
                  .map((column) => (
                    <label key={column.key} className="employees-column-option">
                      <input
                        type="checkbox"
                        checked={visibleColumns[column.key]}
                        onChange={() => toggleColumn(column.key)}
                      />
                      {column.label}
                    </label>
                  ))}
                {Object.values(visibleColumns).some((isVisible) => !isVisible) && (
                  <button
                    type="button"
                    className="employees-column-reset"
                    onClick={() => setVisibleColumns({ ...defaultVisibleEmployeeColumns })}
                  >
                    Показать все столбцы
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isDataPending ? (
        <PageLoader />
      ) : (
      <div className="employees-content">
        <aside className="employees-sidebar">
          <div className="employees-filter-block">
            <div className="employees-filter-title">{t('filter_section_general')}</div>
            <div className="employees-filters-grid">
              <div className="employees-filter-item">
                <label htmlFor="gender-filter">
                  {t('filter_label_gender')}
                  <span className="employees-filter-badge">доступно {employeesAvailableCounts.gender}</span>
                </label>
                <select
                  id="gender-filter"
                  value={filters.gender}
                  onChange={(e) => handleFilterChange('gender', e.target.value as GenderType)}
                >
                  <option value="all">{t('filter_option_any')}</option>
                  {allGenders.map((genderOption) => (
                    <option key={genderOption} value={genderOption}>
                      {genderOption === 'male' ? t('gender_male') : genderOption === 'female' ? t('gender_female') : genderOption}
                      {genderCountByValue.get(genderOption) !== undefined ? ` (${genderCountByValue.get(genderOption)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="employees-filter-item">
                <label htmlFor="affiliate-filter">
                  {t('filter_label_affiliate')}
                  <span className="employees-filter-badge">доступно {employeesAvailableCounts.affiliate}</span>
                </label>
                <select
                  id="affiliate-filter"
                  value={filters.affiliateType}
                  onChange={(e) => handleFilterChange('affiliateType', e.target.value as AffiliateType)}
                >
                  <option value="all">{t('filter_option_all')}</option>
                  {allAffiliateTypes.map((affiliateOption) => (
                    <option key={affiliateOption} value={affiliateOption}>
                      {affiliateOption === 'staff' ? t('affiliate_staff') : affiliateOption === 'external' ? t('affiliate_external') : affiliateOption}
                      {affiliateCountByValue.get(affiliateOption) !== undefined ? ` (${affiliateCountByValue.get(affiliateOption)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="employees-filter-item">
                <label htmlFor="citizenship-filter">
                  {t('filter_label_citizenship')}
                  <span className="employees-filter-badge">доступно {employeesAvailableCounts.citizenship}</span>
                </label>
                <select
                  id="citizenship-filter"
                  value={filters.citizenship}
                  onChange={(e) => handleFilterChange('citizenship', e.target.value as CitizenshipType)}
                >
                  <option value="all">{t('filter_option_any')}</option>
                  {allCitizenships.map((citizenshipOption) => (
                    <option key={citizenshipOption} value={citizenshipOption}>
                      {citizenshipOption === 'resident'
                        ? t('citizenship_resident')
                        : citizenshipOption === 'non-resident'
                          ? t('citizenship_nonresident')
                          : citizenshipOption}
                      {citizenshipCountByValue.get(citizenshipOption) !== undefined ? ` (${citizenshipCountByValue.get(citizenshipOption)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="employees-filter-item">
                <label htmlFor="regionId">
                  {t('employee_col_region')}
                  <span className="employees-filter-badge">доступно {employeesAvailableCounts.region}</span>
                </label>
                <select
                  id="regionId"
                  value={filters.regionId}
                  onChange={(e) => handleFilterChange('regionId', e.target.value as RegionId | 'all')}
                >
                  <option value="all">{t('filter_option_all_regions')}</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="employees-filter-block">
            <div className="employees-filter-title">{t('filter_section_activity')}</div>
            <div className="employees-filters-grid">
              <div className="employees-filter-item">
                <label htmlFor="degree-filter">
                  {t('filter_label_degree')}
                  <span className="employees-filter-badge">доступно {employeesAvailableCounts.degree}</span>
                </label>
                <select
                  id="degree-filter"
                  value={filters.degree}
                  onChange={(e) => handleFilterChange('degree', e.target.value as DegreeType)}
                >
                  <option value="all">{t('filter_option_all_degrees')}</option>
                  {allDegrees.map((degreeOption) => (
                    <option key={degreeOption} value={degreeOption}>
                      {degreeOption}
                      {degreeCountByValue.get(degreeOption) !== undefined ? ` (${degreeCountByValue.get(degreeOption)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="employees-filter-item">
                <label htmlFor="department-filter">
                  {t('filter_label_department')}
                  <span className="employees-filter-badge">доступно {employeesAvailableCounts.department}</span>
                </label>
                <select
                  id="department-filter"
                  value={filters.department}
                  onChange={(e) => handleFilterChange('department', e.target.value)}
                >
                  <option value="all">{t('filter_option_all_departments')}</option>
                  {allDepartments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                      {departmentCountByValue.get(department) !== undefined ? ` (${departmentCountByValue.get(department)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="employees-filter-item">
                <label htmlFor="project-role-filter">
                  {t('filter_label_project_role')}
                  <span className="employees-filter-badge">доступно {employeesAvailableCounts.projectRole}</span>
                </label>
                <select
                  id="project-role-filter"
                  value={filters.projectRole}
                  onChange={(e) => handleFilterChange('projectRole', e.target.value)}
                >
                  <option value="all">{t('filter_option_all_roles')}</option>
                  {allProjectRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                      {projectRoleCountByValue.get(role) !== undefined ? ` (${projectRoleCountByValue.get(role)})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="employees-filter-block">

            <div className="employees-filter-title">{t('filter_section_research_codes')}</div>
            <div className="employees-filters-grid">
              <div className="employees-filter-item">

                <label htmlFor="mrnti">
                  {t('filter_label_mrnti')}
                  <span className="employees-filter-badge">доступно {employeesAvailableCounts.mrnti}</span>
                </label>
                <select
                  id="mrnti"
                  value={filters.mrnti}
                  onChange={(e) => handleFilterChange('mrnti', e.target.value as MRNTIType)}
                >
                  <option value="all">{t('filter_option_all_codes')}</option>
                  {allMrntiCodes.map((mrntiOption) => (
                    <option key={mrntiOption} value={mrntiOption}>
                      {mrntiOption === '11.00.00'
                        ? `${mrntiOption} — ${t('mrnti_11_desc')}`
                        : mrntiOption === '27.00.00'
                          ? `${mrntiOption} — ${t('mrnti_27_desc')}`
                          : mrntiOption === '55.00.00'
                            ? `${mrntiOption} — ${t('mrnti_55_desc')}`
                            : mrntiOption}
                      {mrntiCountByValue.get(mrntiOption) !== undefined ? ` (${mrntiCountByValue.get(mrntiOption)})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

         <div className="employees-filter-block">

            <div className="employees-filter-title">{t('filter_section_metrics')}</div>
            <div className="employees-filter-item employees-filter-item--vertical">

              <label>{t('filter_label_age_years')}</label>
              <div className="employees-age-range">
                <input
                  type="number"
                  min={MIN_AGE_LIMIT}
                  max={MAX_AGE_LIMIT}
                  value={filters.minAge.toString()}
                  onChange={(e) => handleAgeChange('minAge', e.target.value)}
                />
                <span>—</span>
                <input
                  type="number"
                  min={MIN_AGE_LIMIT}
                  max={MAX_AGE_LIMIT}
                  value={filters.maxAge.toString()}
                  onChange={(e) => handleAgeChange('maxAge', e.target.value)}
                />
              </div>
            </div>

            <div className="employees-filter-item">

              <label htmlFor="h-index-filter">
                {t('filter_label_hindex')}
                <span className="employees-filter-badge">доступно {employeesAvailableCounts.hIndex}</span>
              </label>
              <select
                id="h-index-filter"
                value={filters.hIndexGroup}
                onChange={(e) => handleFilterChange('hIndexGroup', e.target.value as HIndexGroup)}
              >
                <option value="all">{t('filter_option_all_values')}</option>
                {allHIndexGroups.map((hIndexGroupOption) => (
                  <option key={hIndexGroupOption} value={hIndexGroupOption}>
                    {hIndexGroupOption === '10+' ? t('hindex_10_plus') : hIndexGroupOption.replace('-', ' - ')}
                    {hIndexGroupCountByValue.get(hIndexGroupOption) !== undefined ? ` (${hIndexGroupCountByValue.get(hIndexGroupOption)})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="employees-filter-actions">
            <button type="button" className="employees-primary-button" onClick={applyFilters}>
              Применить
            </button>

            <button type="button" className="employees-header-button employees-reset-button" onClick={resetFilters}>
              {t('button_reset_filters')}
            </button>
          </div>
        </aside>
<main className="employees-main">
          <section className="employees-table-section">
            <div className="employee-table-container">
              <table className="employee-table">
                <thead>
                  <tr>
                    {activeColumns.map((column) => {
                      if (column.sortKey) {
                        const isAgeColumn = column.sortKey === 'age';
                        const sortKey = isAgeColumn ? 'birthYear' : column.sortKey;
                        const headerState = sort.key === sortKey ? sort.direction : undefined;
                        return (
                          <th
                            key={column.key}
                            onClick={() =>
                              handleSortChange((isAgeColumn ? 'age' : column.sortKey) as keyof Employee | 'age')
                            }
                            className={`employee-th employee-th--${column.key}${headerState ? ` ${headerState}` : ''}`}
                          >
                            {column.label}
                            <ArrowUpDown size={14} />
                          </th>
                        );
                      }

                      return (
                        <th key={column.key} className={`employee-th employee-th--${column.key}`}>
                          {column.label}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {isRefreshing
                    ? Array.from({ length: tableSkeletonRows }).map((_, rowIndex) => (
                        <tr key={`employees-skeleton-${rowIndex}`} className="employees-skeleton-row">
                          {activeColumns.map((column) => (
                            <td
                              key={`employees-skeleton-${rowIndex}-${column.key}`}
                              className={`employee-cell employee-cell--${column.key}`}
                            >
                              <span className="employees-skeleton-cell" aria-hidden="true" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : filteredEmployees.map((employee) => (
                        <tr key={employee.id}>
                          {activeColumns.map((column) => (
                            <td
                              key={`${employee.id}-${column.key}`}
                              className={`employee-cell employee-cell--${column.key}`}
                            >
                              {renderEmployeeCell(column.key, employee)}
                            </td>
                          ))}
                        </tr>
                      ))}
                </tbody>
              </table>

              {!isRefreshing && filteredEmployees.length === 0 && (
                <div className="no-results">{t('employees_not_found')}</div>
              )}
            </div>
            <p className="employees-summary">
              {t('show_employees_summary')}{filteredEmployees.length} {t('from_total_summary')}{pageMeta.total}
            </p>
            <div className="employees-pagination">
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

export default EmployeesPage;