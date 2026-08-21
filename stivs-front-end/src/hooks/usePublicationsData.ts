import { useCallback, useEffect, useState } from 'react';
import type { BackendPublication, PaginationMeta } from '../api/types';
import { publicationsApi } from '../api/services';
import { usePaginatedRemoteData } from './usePaginatedRemoteData';

interface PublicationsFilterParams {
  startYear: number;
  endYear: number;
  irn: string;
  financingType: string;
}

interface UsePublicationsDataParams {
  filters: PublicationsFilterParams;
  currentPage: number;
  pageLimit: number;
  normalizeMeta: (meta: PaginationMeta | undefined, fallbackPage: number) => PaginationMeta;
}

export const usePublicationsData = ({
  filters,
  currentPage,
  pageLimit,
  normalizeMeta,
}: UsePublicationsDataParams) => {
  const [publicationFilters, setPublicationFilters] = useState<{
    type: string[];
    applicant: string[];
  } | null>(null);
  const [publicationFiltersMeta, setPublicationFiltersMeta] = useState<{
    type: Array<{ value: string; count: number }>;
    applicant: Array<{ value: string; count: number }>;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();

    const loadPublicationFilters = async () => {
      try {
        const payload = await publicationsApi.filters();
        if (!controller.signal.aborted) {
          setPublicationFilters({
            type: payload.type,
            applicant: payload.applicant,
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setPublicationFilters(null);
        }
      }
    };

    void loadPublicationFilters();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadPublicationFiltersMeta = async () => {
      try {
        const payload = await publicationsApi.filtersMeta({
          q: filters.irn !== 'all' ? filters.irn : undefined,
          type: filters.financingType !== 'all' ? filters.financingType : undefined,
          year: filters.startYear === filters.endYear ? filters.startYear : undefined,
        }, controller.signal);

        setPublicationFiltersMeta({
          type: payload.type,
          applicant: payload.applicant,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setPublicationFiltersMeta(null);
      }
    };

    void loadPublicationFiltersMeta();

    return () => {
      controller.abort();
    };
  }, [filters.financingType, filters.irn, filters.startYear, filters.endYear]);

  const loadPage = useCallback(async (signal: AbortSignal) => {
    const payload = await publicationsApi.list({
      page: currentPage,
      limit: pageLimit,
      q: filters.irn !== 'all' ? filters.irn : undefined,
      type: filters.financingType !== 'all' ? filters.financingType : undefined,
      year: filters.startYear === filters.endYear ? filters.startYear : undefined,
    }, signal);

    return {
      items: payload.items,
      meta: normalizeMeta(payload.meta, currentPage),
    };
  }, [currentPage, filters.irn, filters.financingType, filters.startYear, filters.endYear, normalizeMeta, pageLimit]);

  const {
    data: publicationsData,
    isLoading,
    hasLoaded,
    loadError,
    pageMeta,
  } = usePaginatedRemoteData<BackendPublication, BackendPublication>({
    currentPage,
    pageLimit,
    fallbackItems: [],
    mapItem: (item) => item,
    loadPage,
    errorMessage: 'Не удалось загрузить публикации с backend.',
  });

  return {
    publicationsData,
    isLoading,
    hasLoaded,
    loadError,
    publicationFilters,
    publicationFiltersMeta,
    pageMeta,
  };
};
