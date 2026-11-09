import type { EntryKind, Quest, QuestCategory, QuestLog, QuestRepeat, QuestStatus } from './api';
import { addDays, parseDay } from './dates';

export const entryKindLabels: Record<EntryKind, string> = {
  note: 'Заметка',
  event: 'Событие',
  link: 'Ссылка',
  expense: 'Расход',
  food: 'Питание',
};

export const categoryLabels: Record<QuestCategory, string> = {
  maintenance: 'Поддержание',
  growth: 'Развитие',
  exploration: 'Исследование',
  experiment: 'Эксперимент',
};

export const categoryHints: Record<QuestCategory, string> = {
  maintenance: 'держать в порядке то, что уже есть',
  growth: 'становиться лучше в чём-то',
  exploration: 'узнать новое, посмотреть вокруг',
  experiment: 'попробовать и проверить гипотезу',
};

export const repeatLabels: Record<QuestRepeat, string> = {
  none: 'Не повторять',
  daily: 'Каждый день',
  weekdays: 'По будням',
  weekly: 'Каждую неделю',
  monthly: 'Каждый месяц',
};

export const statusLabels: Record<QuestStatus, string> = {
  done: 'выполнен',
  postponed: 'отложен',
  declined: 'отклонён',
};

/** Whether the quest is planned for `day` (it may already have a status there). */
export const occursOn = (quest: Quest, day: string): boolean => {
  if (!quest.date || day < quest.date) return false;
  if (quest.repeat === 'none') return day === quest.date;
  if (quest.repeat_until && day > quest.repeat_until) return false;
  const d = parseDay(day);
  const start = parseDay(quest.date);
  switch (quest.repeat) {
    case 'daily':
      return true;
    case 'weekdays':
      return d.getDay() !== 0 && d.getDay() !== 6;
    case 'weekly':
      return d.getDay() === start.getDay();
    case 'monthly':
      return d.getDate() === start.getDate();
  }
};

export const logKey = (questId: string, day: string) => `${questId}:${day}`;

export const indexLogs = (logs: QuestLog[]) => new Map(logs.map((l) => [logKey(l.quest_id, l.day), l]));

export type Occurrence = { quest: Quest; day: string; log: QuestLog | undefined };

const byTime = (a: Occurrence, b: Occurrence) =>
  (a.quest.time ?? '99').localeCompare(b.quest.time ?? '99') ||
  a.quest.created_at.localeCompare(b.quest.created_at);

/**
 * Today's quests, and one-off quests from earlier days left without a status:
 * they wait until the user decides what to do with them.
 */
export const occurrencesFor = (quests: Quest[], logs: Map<string, QuestLog>, day: string) => {
  const todays: Occurrence[] = [];
  const overdue: Occurrence[] = [];
  for (const quest of quests) {
    const log = logs.get(logKey(quest.id, day));
    // A quest postponed today has moved on, but today's status stays visible.
    if (occursOn(quest, day) || log) {
      todays.push({ quest, day, log });
    } else if (
      quest.repeat === 'none' &&
      quest.date &&
      quest.date < day &&
      !logs.has(logKey(quest.id, quest.date))
    ) {
      overdue.push({ quest, day: quest.date, log: undefined });
    }
  }
  return { todays: todays.sort(byTime), overdue: overdue.sort(byTime) };
};

/** Next day the quest occurs on after `day`, within a year; null if none. */
export const nextOccurrence = (quest: Quest, day: string): string | null => {
  for (let i = 1; i <= 366; i++) {
    const next = addDays(day, i);
    if (occursOn(quest, next)) return next;
  }
  return null;
};

export const describeSchedule = (quest: Quest): string => {
  if (!quest.date) return 'Когда-нибудь';
  const time = quest.time ? `, ${quest.time.slice(0, 5)}` : '';
  if (quest.repeat === 'none') return `${quest.date}${time}`;
  const until = quest.repeat_until ? ` до ${quest.repeat_until}` : '';
  return `${repeatLabels[quest.repeat]} с ${quest.date}${until}${time}`;
};
