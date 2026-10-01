import { useEffect, useState } from 'react';
import { publicationsApi } from '../api/services';
import type {
  PublicationsAnalyticsFilterOptions,
  PublicationsAnalyticsQuery,
  PublicationsDistributions,
  PublicationsSummary,
  PublicationsTimeseriesItem,
} from '../api/types';

interface PublicationsAnalyticsData {
  summary: PublicationsSummary;
  timeseries: PublicationsTimeseriesItem[];
  distributions: PublicationsDistributions;
}

export const usePublicationsAnalytics = (query: PublicationsAnalyticsQuery) => {
  const [filterOptions, setFilterOptions] = useState<PublicationsAnalyticsFilterOptions | null>(null);
  const [data, setData] = useState<PublicationsAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    publicationsApi
      .analyticsFilters(controller.signal)
      .then((payload) => setFilterOptions(payload))
      .catch(() => {
        if (!controller.signal.aborted) {
          setFilterOptions(null);
        }
      });
    return () => controller.abort();
  }, []);

  // Serialized so that a new object with the same values does not refetch.
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    const controller = new AbortController();
    const parsedQuery = JSON.parse(queryKey) as PublicationsAnalyticsQuery;
    setIsLoading(true);

    Promise.all([
      publicationsApi.summary(parsedQuery, controller.signal),
      publicationsApi.timeseries(parsedQuery, controller.signal),
      publicationsApi.distributions(parsedQuery, controller.signal),
    ])
      .then(([summary, timeseries, distributions]) => {
        setData({ summary, timeseries: timeseries.items, distributions });
        setLoadError(null);
        setHasLoaded(true);
        setIsLoading(false);
      })
      .catch((error) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }
        setLoadError('Не удалось загрузить данные результативности с backend.');
        setHasLoaded(true);
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [queryKey]);

  return { filterOptions, data, isLoading, hasLoaded, loadError };
};
