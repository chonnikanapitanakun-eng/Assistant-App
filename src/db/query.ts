import { keepPreviousData, QueryClient, useQuery } from '@tanstack/react-query';

import { onDatabaseWrite } from './client';

/**
 * Reactive reads, replacing drizzle-orm/expo-sqlite's `useLiveQuery` (sync-only).
 * Reads go through react-query; any DB write invalidates every DB query, and mounted ones refetch.
 * Refetching everything is cheap at personal-data scale and far simpler than per-table keys.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    // Local database: never stale until a write says so, no retries, and no "offline" pausing.
    queries: { staleTime: Infinity, retry: false, networkMode: 'always' },
    mutations: { networkMode: 'always' },
  },
});

const DB_KEY = 'db';

onDatabaseWrite(() => {
  void queryClient.invalidateQueries({ queryKey: [DB_KEY] });
});

/**
 * Read from the DB, re-run after every write. `undefined` until the first result.
 * Errors are thrown to the route's error boundary rather than silently showing empty data.
 * `keepPrevious` keeps showing the last result while a new key loads (search-as-you-type).
 */
export function useDbQuery<T>(key: readonly unknown[], query: () => Promise<T>, opts: { keepPrevious?: boolean } = {}): T | undefined {
  const { data } = useQuery({
    queryKey: [DB_KEY, ...key],
    queryFn: query,
    throwOnError: true,
    placeholderData: opts.keepPrevious ? keepPreviousData : undefined,
  });
  return data;
}

type RowsQuery<T> = { toSQL(): { sql: string; params: unknown[] }; all(): Promise<T[]> };

const NO_ROWS: never[] = [];

/**
 * Drop-in for `useLiveQuery(select)`: rows of a drizzle select, keyed by its SQL and params.
 * `data` is [] until loaded; `loaded` separates "still loading" from "no rows".
 */
export function useRows<T>(query: RowsQuery<T>, opts?: { keepPrevious?: boolean }): { data: T[]; loaded: boolean } {
  const { sql, params } = query.toSQL();
  const data = useDbQuery(['rows', sql, params], () => query.all(), opts);
  return { data: data ?? NO_ROWS, loaded: data !== undefined };
}
