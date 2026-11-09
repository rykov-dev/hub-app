// Local calendar days as 'YYYY-MM-DD' strings: what the user sees as "today"
// doesn't follow UTC.

const pad = (n: number) => String(n).padStart(2, '0');

export const toDay = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const today = () => toDay(new Date());

/** Local midnight at the start of `day`. */
export const parseDay = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (day: string, n: number): string => {
  const date = parseDay(day);
  date.setDate(date.getDate() + n);
  return toDay(date);
};

/** Local day of an ISO timestamp. */
export const dayOf = (iso: string) => toDay(new Date(iso));

/** Value for <input type="datetime-local"> from an ISO timestamp. */
export const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return `${toDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** ISO timestamp from an <input type="datetime-local"> value. */
export const fromLocalInput = (value: string) => new Date(value).toISOString();

const dayFormat = new Intl.DateTimeFormat('ru', { weekday: 'short', day: 'numeric', month: 'long' });
const timeFormat = new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' });

export const formatDay = (day: string) => dayFormat.format(parseDay(day));
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));
/** 'HH:MM' from a Postgres time value ('HH:MM:SS'). */
export const shortTime = (time: string) => time.slice(0, 5);
