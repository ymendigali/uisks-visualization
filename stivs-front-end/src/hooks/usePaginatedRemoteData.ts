import { useEffect, useRef, useState } from 'react';
import type { PaginationMeta } from '../api/types';
import { ApiError } from '../api/client';

interface PaginatedResponseLike<TItem> {
  items: TItem[];
  meta: PaginationMeta;
}

interface UsePaginatedRemoteDataParams<TIn, TOut> {
  currentPage: number;
  pageLimit: number;
  fallbackItems: TOut[];
  mapItem: (item: TIn) => TOut;
  loadPage: (signal: AbortSignal) => Promise<PaginatedResponseLike<TIn>>;
  errorMessage: string;
}

export const usePaginatedRemoteData = <TIn, TOut>({
  currentPage,
  pageLimit,
  fallbackItems,
  mapItem,
  loadPage,
  errorMessage,
}: UsePaginatedRemoteDataParams<TIn, TOut>) => {
  const [data, setData] = useState<TOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const mapItemRef = useRef(mapItem);
  const fallbackItemsRef = useRef(fallbackItems);
  const [pageMeta, setPageMeta] = useState<PaginationMeta>({
    page: 1,
    limit: pageLimit,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  useEffect(() => {
    mapItemRef.current = mapItem;
  }, [mapItem]);

  useEffect(() => {
    fallbackItemsRef.current = fallbackItems;
  }, [fallbackItems]);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const run = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const payload = await loadPage(controller.signal);
        if (requestIdRef.current !== requestId || controller.signal.aborted) {
          return;
        }
        setData(payload.items.map((item) => mapItemRef.current(item)));
        setPageMeta(payload.meta);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        if (requestIdRef.current !== requestId || controller.signal.aborted) {
          return;
        }

        const message = error instanceof ApiError ? error.message : errorMessage;
        setLoadError(message);
        const fallbackTotal = fallbackItemsRef.current.length;
        setData([]);
        setPageMeta({
          page: currentPage,
          limit: pageLimit,
          total: fallbackTotal,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        });
      } finally {
        if (requestIdRef.current === requestId && !controller.signal.aborted) {
          setIsLoading(false);
          setHasLoaded(true);
        }
      }
    };

    void run();

    return () => {
      controller.abort();
    };
  }, [currentPage, pageLimit, loadPage, errorMessage]);

  return {
    data,
    isLoading,
    hasLoaded,
    loadError,
    pageMeta,
  };
};
