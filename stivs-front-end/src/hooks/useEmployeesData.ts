import { useCallback, useEffect, useState } from 'react';
import { employeesApi } from '../api/services';
import type { BackendEmployee, EmployeeFilterMeta, EmployeeFilterOptions } from '../api/types';
import { usePaginatedRemoteData } from './usePaginatedRemoteData';

interface EmployeesFilterParams {
  searchTerm: string;
  regionId: string;
  position: string;
  department: string;
  minAge: number;
  maxAge: number;
  affiliateType: string;
  gender: string;
  degree: string;
  citizenship: string;
  projectRole: string;
  hIndexGroup: '0-1' | '2-5' | '6-10' | '10+' | 'all';
  mrnti: string;
  classifier: string;
}

const H_INDEX_RANGE_BY_GROUP: Record<EmployeesFilterParams['hIndexGroup'], { min?: number; max?: number }> = {
  '0-1': { min: 0, max: 1 },
  '2-5': { min: 2, max: 5 },
  '6-10': { min: 6, max: 10 },
  '10+': { min: 10 },
  all: {},
};

interface UseEmployeesDataParams<TEmployee> {
  filters: EmployeesFilterParams;
  selectedRegionId: string;
  regionNameById: Record<string, string>;
  currentPage: number;
  pageLimit: number;
  fallbackItems: TEmployee[];
  mapItem: (item: BackendEmployee) => TEmployee;
}

export const useEmployeesData = <TEmployee>({
  filters,
  selectedRegionId,
  regionNameById,
  currentPage,
  pageLimit,
  fallbackItems,
  mapItem,
}: UseEmployeesDataParams<TEmployee>) => {
  const [employeeFilters, setEmployeeFilters] = useState<EmployeeFilterOptions | null>(null);
  const [employeeFiltersMeta, setEmployeeFiltersMeta] = useState<EmployeeFilterMeta | null>(null);

  const selectedRegionName =
    filters.regionId === 'all'
      ? (selectedRegionId === 'national' ? undefined : (regionNameById[selectedRegionId] ?? undefined))
      : (regionNameById[filters.regionId] ?? undefined);

  const hIndexRange = H_INDEX_RANGE_BY_GROUP[filters.hIndexGroup];
  useEffect(() => {
    const controller = new AbortController();

    const loadEmployeeFilters = async () => {
      try {
        const payload = await employeesApi.filters();
        if (!controller.signal.aborted) {
          setEmployeeFilters({
            searchTerm: payload.searchTerm ?? '',
            region: payload.region ?? [],
            position: payload.position ?? [],
            department: payload.department ?? [],
            minAge: Number.isFinite(payload.minAge) ? payload.minAge : 20,
            maxAge: Number.isFinite(payload.maxAge) ? payload.maxAge : 80,
            affiliateType: payload.affiliateType ?? [],
            gender: payload.gender ?? [],
            degree: payload.degree ?? [],
            citizenship: payload.citizenship ?? [],
            projectRole: payload.projectRole ?? [],
            hIndexGroup: payload.hIndexGroup ?? [],
            mrnti: payload.mrnti ?? [],
            classifier: payload.classifier ?? [],
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setEmployeeFilters(null);
        }
      }
    };

    void loadEmployeeFilters();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadEmployeeFiltersMeta = async () => {
      try {
        const payload = await employeesApi.filtersMeta({
          region: selectedRegionName,
          position: filters.position === 'all' ? undefined : filters.position,
          department: filters.department === 'all' ? undefined : filters.department,
          minAge: filters.minAge,
          maxAge: filters.maxAge,
          affiliateType: filters.affiliateType === 'all' ? undefined : filters.affiliateType,
          gender: filters.gender === 'all' ? undefined : filters.gender,
          degree: filters.degree === 'all' ? undefined : filters.degree,
          citizenship: filters.citizenship === 'all' ? undefined : filters.citizenship,
          projectRole: filters.projectRole === 'all' ? undefined : filters.projectRole,
          hIndexGroup: filters.hIndexGroup === 'all' ? undefined : filters.hIndexGroup,
          mrnti: filters.mrnti === 'all' ? undefined : filters.mrnti,
          classifier: filters.classifier === 'all' ? undefined : filters.classifier,
          minHIndex: hIndexRange.min,
          maxHIndex: hIndexRange.max,
          q: filters.searchTerm || undefined,
        }, controller.signal);

        setEmployeeFiltersMeta(payload);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setEmployeeFiltersMeta(null);
      }
    };

    void loadEmployeeFiltersMeta();

    return () => {
      controller.abort();
    };
  }, [
    filters.affiliateType,
    filters.citizenship,
    filters.classifier,
    filters.department,
    filters.degree,
    filters.gender,
    filters.hIndexGroup,
    filters.maxAge,
    filters.minAge,
    filters.mrnti,
    filters.position,
    filters.projectRole,
    filters.regionId,
    filters.searchTerm,
    regionNameById,
    selectedRegionName,
  ]);

  const loadPage = useCallback((signal: AbortSignal) => {
    return employeesApi.list({
      page: currentPage,
      limit: pageLimit,
      searchTerm: filters.searchTerm || undefined,
      region: selectedRegionName,
      position: filters.position === 'all' ? undefined : filters.position,
      department: filters.department === 'all' ? undefined : filters.department,
      minAge: filters.minAge,
      maxAge: filters.maxAge,
      affiliateType: filters.affiliateType === 'all' ? undefined : filters.affiliateType,
      gender: filters.gender === 'all' ? undefined : filters.gender,
      degree: filters.degree === 'all' ? undefined : filters.degree,
      citizenship: filters.citizenship === 'all' ? undefined : filters.citizenship,
      projectRole: filters.projectRole === 'all' ? undefined : filters.projectRole,
      hIndexGroup: filters.hIndexGroup === 'all' ? undefined : filters.hIndexGroup,
      mrnti: filters.mrnti === 'all' ? undefined : filters.mrnti,
      classifier: filters.classifier === 'all' ? undefined : filters.classifier,
      minHIndex: hIndexRange.min,
      maxHIndex: hIndexRange.max,
      q: filters.searchTerm || undefined,
    }, signal);
  }, [
    currentPage,
    filters.affiliateType,
    filters.citizenship,
    filters.classifier,
    filters.department,
    pageLimit,
    selectedRegionName,
    filters.gender,
    filters.maxAge,
    filters.minAge,
    filters.mrnti,
    filters.position,
    filters.degree,
    filters.hIndexGroup,
    filters.projectRole,
    filters.searchTerm,
  ]);

  const {
    data: employeesData,
    isLoading,
    hasLoaded,
    loadError,
    pageMeta,
  } = usePaginatedRemoteData({
    currentPage,
    pageLimit,
    fallbackItems,
    mapItem,
    loadPage,
    errorMessage: 'Не удалось загрузить сотрудников с backend.',
  });

  return {
    employeesData,
    isLoading,
    hasLoaded,
    loadError,
    employeeFilters,
    employeeFiltersMeta,
    pageMeta,
  };
};
