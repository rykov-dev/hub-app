import { useEffect, useState } from 'react';
import { today } from '../lib/dates';
import { outbox } from '../lib/offline/outbox';

const storageKey = (userId: string) => `day-start:${userId}`;

const readMarked = (userId: string) => {
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
};

/**
 * Records the first time the app is opened on each local day, also offline.
 * The server keeps the first start, so another device marking the same day
 * changes nothing. Returns today's date, updated when the day changes.
 */
export const useDayStart = (userId: string) => {
  const [day, setDay] = useState(today);

  useEffect(() => {
    const mark = () => {
      const now = today();
      setDay(now);
      if (readMarked(userId) === now) return;
      try {
        localStorage.setItem(storageKey(userId), now);
      } catch {
        // Without localStorage it is marked on every load; the server keeps the first.
      }
      outbox.enqueue({
        kind: 'markDayStart',
        start: { day: now, started_at: new Date().toISOString() },
      });
    };
    mark();
    // An app left open overnight starts the new day when it's looked at again.
    const onVisible = () => document.visibilityState === 'visible' && mark();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId]);

  return day;
};
