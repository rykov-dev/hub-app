import { useCallback, useEffect, useState } from 'react';
import {
  type CoinTransaction,
  type DailyClaimResult,
  type HeartbeatResult,
  type Profile,
  claimDaily,
  endSession,
  fetchProfile,
  fetchTransactions,
  sendHeartbeat,
} from '../lib/api';

const HEARTBEAT_INTERVAL_MS = 60_000;

export type Activity = HeartbeatResult & { receivedAt: number };

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

/**
 * Loads the user's coins, claims the daily visit reward on mount and sends
 * heartbeats while the tab is visible until today's time reward is earned.
 */
export const useRewards = (userId: string) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [dailyClaim, setDailyClaim] = useState<DailyClaimResult | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [p, t] = await Promise.all([fetchProfile(), fetchTransactions()]);
    setProfile(p);
    setTransactions(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    claimDailyOnce(userId)
      .then((result) => {
        if (!cancelled) setDailyClaim(result);
        return refresh();
      })
      .catch((e) => !cancelled && setError(String(e.message ?? e)));
    return () => {
      cancelled = true;
    };
  }, [userId, refresh]);

  const rewardedToday = activity?.rewarded_today ?? false;

  useEffect(() => {
    if (rewardedToday) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    // Bumped on every stop so responses from a previous session are ignored.
    let generation = 0;
    let running = false;
    // Requests are chained so the server sees them in order: a leave never
    // overtakes an in-flight beat, and a beat never overtakes the leave.
    let lastRequest: Promise<unknown> = Promise.resolve();

    const beat = async (gen: number) => {
      if (gen !== generation) return;
      let delay = HEARTBEAT_INTERVAL_MS;
      try {
        const request = sendHeartbeat();
        lastRequest = request.catch(() => {});
        const result = await request;
        if (gen !== generation) return;
        setActivity({ ...result, receivedAt: Date.now() });
        if (result.granted) refresh();
        if (result.rewarded_today) return;
        // Beat right when the session reaches 15 minutes so the reward isn't delayed.
        const remainingMs = (result.required_seconds - result.session_seconds) * 1000;
        delay = Math.min(delay, Math.max(remainingMs + 1000, 1000));
      } catch (e) {
        if (gen !== generation) return;
        setError(String((e as Error).message ?? e));
      }
      timer = setTimeout(() => beat(gen), delay);
    };

    const start = () => {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      const gen = generation;
      lastRequest.then(() => beat(gen));
    };
    const stop = () => {
      running = false;
      generation++;
      clearTimeout(timer);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') return start();
      stop();
      // Leaving the tab breaks the continuous session.
      setActivity(null);
      lastRequest = lastRequest.then(() => endSession()).catch(() => {});
    };

    start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [userId, rewardedToday, refresh]);

  return { profile, transactions, dailyClaim, activity, error };
};
