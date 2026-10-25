import { useEffect, useState } from 'react';
import type { Activity } from '../hooks/useRewards';

const formatTime = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/** Countdown to the time-on-site reward, extrapolated between heartbeats. */
export const SessionTimer = ({ activity }: { activity: Activity | null }) => {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!activity || activity.rewarded_today) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activity]);

  if (activity?.rewarded_today) {
    return (
      <section className="timer">
        <span className="muted">Награда за 15 минут сегодня получена</span>
      </section>
    );
  }

  const required = activity?.required_seconds ?? 15 * 60;
  const elapsed = activity
    ? Math.min(activity.session_seconds + Math.max(0, now - activity.receivedAt) / 1000, required)
    : 0;
  const remaining = Math.ceil(required - elapsed);

  return (
    <section className="timer">
      <span className="muted">До награды за 15 минут без перерыва</span>
      <strong className="timer-value">{formatTime(remaining)}</strong>
      <div className="progress">
        <div style={{ width: `${(elapsed / required) * 100}%` }} />
      </div>
      <span className="muted small">Если уйти со вкладки, таймер начнётся заново</span>
    </section>
  );
};
