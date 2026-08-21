# Hooks Guide

This folder contains reusable data hooks for pages.

## Current hooks

- `usePaginatedRemoteData` — shared loader for paginated lists (loading, error, fallback, `AbortController` cleanup).
- `useProjectsData` — projects page data + filter metadata.
- `useEmployeesData` — employees page data + filter metadata.
- `usePublicationsData` — publications page data + filter metadata + backend meta normalization.
- `useFinanceSummary` — finance summary loader.

## Recommended pattern for new data hooks

1. Keep page UI state in page files.
2. Keep remote data state in hooks from this folder.
3. Use `AbortController` for every async request started in `useEffect`.
4. For paginated lists, build `loadPage(signal)` and delegate request lifecycle to `usePaginatedRemoteData`.
5. Keep API-to-UI mapping in one place (`mapItem`) before data reaches components.
6. Return only what page needs (`data`, `isLoading`, `loadError`, `pageMeta`, filter metadata).

## Minimal template

```ts
const loadPage = useCallback((signal: AbortSignal) => {
  return api.list({ page: currentPage, limit: PAGE_LIMIT }, signal);
}, [currentPage]);

const { data, isLoading, loadError, pageMeta } = usePaginatedRemoteData({
  currentPage,
  pageLimit: PAGE_LIMIT,
  fallbackItems: [],
  mapItem: (item) => item,
  loadPage,
  errorMessage: 'Не удалось загрузить данные.',
});
```

## Notes

- Prefer narrow hook params instead of passing entire page state.
- Keep fallback behavior explicit (empty list or mock subset).
- Normalize backend pagination shape close to data hook (as done in publications).
