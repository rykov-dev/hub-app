import type { DayStart, InboxNote, NoteCommentWithNote, Quest, QuestLog } from './api';
import { dayOf, formatDay, formatTime } from './dates';
import { categoryLabels, entryKindLabels, statusLabels } from './quests';

export type FeedEvent =
  | { type: 'start'; day: string; at: string; start: DayStart }
  | { type: 'entry'; day: string; at: string; note: InboxNote }
  | { type: 'quest'; day: string; at: string; log: QuestLog; quest: Quest | undefined };

/** Entries, quest statuses and day starts by day: newest day first, each day in time order. */
export const buildFeed = (
  notes: InboxNote[],
  logs: QuestLog[],
  starts: DayStart[],
  quests: Quest[],
): [string, FeedEvent[]][] => {
  const questById = new Map(quests.map((q) => [q.id, q]));
  const events: FeedEvent[] = [
    ...starts.map((start) => ({
      type: 'start' as const,
      day: start.day,
      at: start.started_at,
      start,
    })),
    ...notes.map((note) => ({
      type: 'entry' as const,
      day: dayOf(note.created_at),
      at: note.created_at,
      note,
    })),
    ...logs.map((log) => ({
      type: 'quest' as const,
      day: log.day,
      at: log.updated_at,
      log,
      quest: questById.get(log.quest_id),
    })),
  ];
  const days = new Map<string, FeedEvent[]>();
  for (const e of events.sort((a, b) => a.at.localeCompare(b.at))) {
    days.set(e.day, [...(days.get(e.day) ?? []), e]);
  }
  return [...days.entries()].sort(([a], [b]) => b.localeCompare(a));
};

const indent = (text: string, prefix: string) => text.replace(/\n/g, `\n${prefix}`);

export const toMarkdown = (
  from: string,
  to: string,
  feed: [string, FeedEvent[]][],
  comments: NoteCommentWithNote[],
): string => {
  const lines = [`# Hub-app: записи с ${from} по ${to}`, ''];
  // Oldest day first reads naturally in a document.
  for (const [day, events] of [...feed].reverse()) {
    lines.push(`## ${formatDay(day)} (${day})`, '');
    for (const e of events) {
      const time = formatTime(e.at);
      if (e.type === 'start') lines.push(`- ${time} — начало дня`);
      else if (e.type === 'quest') {
        const q = e.quest;
        const title = q ? `«${q.title}» (${categoryLabels[q.category]})` : 'удалённый квест';
        lines.push(`- ${time} — квест ${title}: ${statusLabels[e.log.status]}`);
        if (q?.why) lines.push(`  - зачем: ${indent(q.why, '    ')}`);
      } else {
        const n = e.note;
        const tags = n.tags.length > 0 ? ` ${n.tags.map((t) => `#${t}`).join(' ')}` : '';
        const body = n.body ? indent(n.body, '  ') : '(без текста)';
        lines.push(`- ${time} — **${entryKindLabels[n.kind]}**: ${body}${tags}`);
        if (n.image_path) lines.push(`  - изображение: ${n.image_path}`);
        for (const c of comments.filter((c) => c.note_id === n.id)) {
          lines.push(`  - комментарий (${formatTime(c.created_at)}): ${indent(c.body, '    ')}`);
        }
      }
    }
    lines.push('');
  }
  return lines.join('\n');
};

export const toJson = (
  from: string,
  to: string,
  data: {
    notes: InboxNote[];
    comments: NoteCommentWithNote[];
    logs: QuestLog[];
    starts: DayStart[];
    quests: Quest[];
  },
): string =>
  JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      from,
      to,
      entries: data.notes.map((n) => ({
        ...n,
        comments: data.comments.filter((c) => c.note_id === n.id),
      })),
      quests: data.quests,
      quest_logs: data.logs,
      day_starts: data.starts,
    },
    null,
    2,
  );

/** Saves `content` as a file through the browser's download. */
export const download = (filename: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
