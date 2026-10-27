import { useCallback, useEffect, useRef, useState } from 'react';
import { isNetworkError } from '../lib/offline/network';
import { readStored, writeStored } from '../lib/offline/storage';

type Options<T> = {
  /** Used when nothing is cached under `key` yet, e.g. a note from the cached list. */
  fallback?: () => Promise<T | undefined>;
};

/**
 * Stale-while-revalidate over IndexedDB: shows the last saved result right
 * away, then fetches. Without a connection the saved result stays on screen
 * and no error is shown.
 *
 * `key` must be unique per user and query; a new key starts a new query.
 */
export const useCachedQuery = <T>(key: string, fetcher: () => Promise<T>, options: Options<T> = {}) => {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const fallbackRef = useRef(options.fallback);
  fallbackRef.current = options.fallback;
  const keyRef = useRef(key);
  keyRef.current = key;

  const refetch = useCallback(async () => {
    try {
      const fresh = await fetcherRef.current();
      writeStored(key, fresh);
      // A response for a previous key must not land in the current query.
      if (keyRef.current !== key) return;
      setDataState(fresh);
      setError(null);
    } catch (e) {
      if (keyRef.current === key && !isNetworkError(e)) setError(String((e as Error).message ?? e));
    } finally {
      if (keyRef.current === key) setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    let cancelled = false;
    setDataState(undefined);
    setLoading(true);
    (async () => {
      const cached = (await readStored<T>(key)) ?? (await fallbackRef.current?.());
      // Don't overwrite a fetch that finished first.
      if (!cancelled && cached !== undefined) setDataState((d) => (d === undefined ? cached : d));
    })();
    refetch();
    return () => {
      cancelled = true;
    };
  }, [key, refetch]);

  /** Local update (e.g. a synced change) that is also saved for offline use. */
  const setData = useCallback(
    (update: (data: T | undefined) => T | undefined) => {
      setDataState((d) => {
        const next = update(d);
        if (next !== undefined) writeStored(key, next);
        return next;
      });
    },
    [key],
  );

  return { data, error, loading, refetch, setData };
};
