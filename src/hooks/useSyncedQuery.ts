import { useCallback, useMemo } from 'react';
import type { OutboxItem } from '../lib/offline/outbox';
import { useCachedQuery } from './useCachedQuery';
import { useOutbox, useOutboxApplied } from './useOutbox';

/**
 * Server data (or its offline copy) with changes still waiting to sync
 * applied on top. `fetcher` and `apply` must be stable.
 *
 * Offline with nothing cached, it starts from `empty`: only this device's
 * pending changes are known then.
 */
export const useSyncedQuery = <T>(
  key: string,
  fetcher: () => Promise<T>,
  apply: (data: T, item: OutboxItem) => T,
  empty: T,
) => {
  const { data, error, loading, refetch, setData } = useCachedQuery<T>(key, fetcher);
  const { items } = useOutbox();

  useOutboxApplied(
    useCallback((item: OutboxItem) => setData((d) => d && apply(d, item)), [setData, apply]),
  );

  const value = useMemo(() => {
    const base = data ?? (loading ? undefined : empty);
    return base === undefined ? undefined : items.reduce(apply, base);
  }, [data, loading, items, apply, empty]);

  return { data: value, error, refetch };
};
