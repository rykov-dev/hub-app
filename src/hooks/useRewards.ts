import { useCallback, useEffect, useState } from 'react';
import {
  type CoinTransaction,
  type DailyClaimResult,
  type Profile,
  claimDaily,
  fetchProfile,
  fetchTransactions,
} from '../lib/api';
import { isNetworkError } from '../lib/offline/network';
import { useCachedQuery } from './useCachedQuery';
import { useOnline } from './useOnline';

// One daily claim per user per page load, so a remount (e.g. StrictMode)
// doesn't replace the "claimed" result with a repeated "already claimed".
const dailyClaims = new Map<string, Promise<DailyClaimResult>>();
const claimDailyOnce = (userId: string) => {
  let claim = dailyClaims.get(userId);
  if (!claim) {
    claim = claimDaily();
    claim.catch(() => dailyClaims.delete(userId));
    dailyClaims.set(userId, claim);
  }
  return claim;
};

const fetchRecentTransactions = () => fetchTransactions();

/**
 * Loads the user's coins and streak and claims the daily visit reward.
 *
 * Coins and history are kept for offline use. The reward needs the server,
 * so offline it waits and is claimed when the connection comes back.
 */
export const useRewards = (userId: string) => {
  const online = useOnline();
  const profileQuery = useCachedQuery<Profile>(`${userId}:profile`, fetchProfile);
  const transactionsQuery = useCachedQuery<CoinTransaction[]>(
    `${userId}:transactions`,
    fetchRecentTransactions,
  );
  const [dailyClaim, setDailyClaim] = useState<DailyClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetchProfile = profileQuery.refetch;
  const refetchTransactions = transactionsQuery.refetch;
  const refresh = useCallback(async () => {
    await Promise.all([refetchProfile(), refetchTransactions()]);
  }, [refetchProfile, refetchTransactions]);

  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    claimDailyOnce(userId)
      .then((result) => {
        if (!cancelled) setDailyClaim(result);
        return refresh();
      })
      .catch((e) => !cancelled && !isNetworkError(e) && setError(String(e.message ?? e)));
    return () => {
      cancelled = true;
    };
  }, [userId, online, refresh]);

  return {
    profile: profileQuery.data ?? null,
    /** True until the cached or fetched profile is known. */
    profileLoading: profileQuery.loading && profileQuery.data === undefined,
    transactions: transactionsQuery.data ?? [],
    dailyClaim,
    error: error ?? profileQuery.error ?? transactionsQuery.error,
    refresh,
  };
};
