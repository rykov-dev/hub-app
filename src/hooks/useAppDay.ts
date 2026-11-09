import { useCallback, useEffect, useState } from 'react';
import { type DayStart, fetchDayStarts } from '../lib/api';
import { addDays, toDay } from '../lib/dates';
import { applyToDayStarts } from '../lib/offline/apply';
import { outbox } from '../lib/offline/outbox';
import { useSyncedQuery } from './useSyncedQuery';

/** Until this hour a day nobody started still counts as the previous one. */
const CUTOFF_HOURS = 5;

const noStarts: DayStart[] = [];

/**
 * The user's current day, which needn't change at midnight: a night at 2 a.m.
 * still belongs to the evening before. The day starts with the "start the day"
 * button, or at 05:00 if it wasn't pressed. Starts are kept per calendar date
 * and synced, so all devices agree.
 */
export const useAppDay = (userId: string) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, 60_000);
    // An app left open overnight catches up when it's looked at again.
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const calendarDay = toDay(now);
  const { data: starts } = useSyncedQuery(
    `${userId}:day-starts`,
    useCallback(() => fetchDayStarts(addDays(calendarDay, -2), calendarDay), [calendarDay]),
    applyToDayStarts,
    noStarts,
  );

  const byCutoff = toDay(new Date(now.getTime() - CUTOFF_HOURS * 3_600_000));
  const latestStarted = starts?.filter((s) => s.day <= calendarDay).slice(-1)[0]?.day;
  const day = latestStarted && latestStarted > byCutoff ? latestStarted : byCutoff;

  const startDay = useCallback(() => {
    const at = new Date();
    outbox.enqueue({
      kind: 'markDayStart',
      start: { day: toDay(at), started_at: at.toISOString() },
    });
    setNow(at);
  }, []);

  return {
    /** Current day, 'YYYY-MM-DD'. */
    day,
    /** When the current day was started with the button, if it was. */
    startedAt: starts?.find((s) => s.day === day)?.started_at ?? null,
    /** The calendar day hasn't been started yet, so the button makes sense. */
    canStart: starts !== undefined && !starts.some((s) => s.day === calendarDay),
    startDay,
  };
};
