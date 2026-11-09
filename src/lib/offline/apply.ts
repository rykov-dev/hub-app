import type { DayStart, InboxNote, NoteComment, Quest, QuestLog } from '../api';
import type { OutboxItem } from './outbox';

// Applying queued changes to server data gives what the user should see: used
// for pending changes on screen, and for synced ones until the next fetch.

const byNewest = (a: InboxNote, b: InboxNote) => b.created_at.localeCompare(a.created_at);

export const applyToNotes = (notes: InboxNote[], item: OutboxItem): InboxNote[] => {
  switch (item.kind) {
    case 'addNote':
      return notes.some((n) => n.id === item.note.id)
        ? notes
        : [item.note, ...notes].sort(byNewest);
    case 'updateNote':
      return notes
        .map((n) => (n.id === item.noteId ? { ...n, ...item.patch } : n))
        .sort(byNewest);
    case 'setTags':
      return notes.map((n) => (n.id === item.noteId ? { ...n, tags: item.tags } : n));
    case 'deleteNote':
      return notes.filter((n) => n.id !== item.noteId);
    default:
      return notes;
  }
};

export const applyToNote = (note: InboxNote | null, id: string, item: OutboxItem) => {
  if (item.kind === 'addNote' && item.note.id === id) return note ?? item.note;
  if (item.kind === 'updateNote' && item.noteId === id && note) return { ...note, ...item.patch };
  if (item.kind === 'setTags' && item.noteId === id && note) return { ...note, tags: item.tags };
  if (item.kind === 'deleteNote' && item.noteId === id) return null;
  return note;
};

export const applyToComments = (
  comments: NoteComment[],
  noteId: string,
  item: OutboxItem,
): NoteComment[] =>
  item.kind === 'addComment' &&
  item.noteId === noteId &&
  !comments.some((c) => c.id === item.comment.id)
    ? [...comments, item.comment]
    : comments;

export const applyToQuests = (quests: Quest[], item: OutboxItem): Quest[] => {
  switch (item.kind) {
    case 'addQuest':
      return quests.some((q) => q.id === item.quest.id) ? quests : [...quests, item.quest];
    case 'updateQuest':
      return quests.map((q) => (q.id === item.questId ? { ...q, ...item.patch } : q));
    case 'deleteQuest':
      return quests.filter((q) => q.id !== item.questId);
    default:
      return quests;
  }
};

export const applyToQuestLogs = (logs: QuestLog[], item: OutboxItem): QuestLog[] => {
  switch (item.kind) {
    case 'setQuestStatus': {
      const rest = logs.filter((l) => !(l.quest_id === item.questId && l.day === item.day));
      return item.status === null
        ? rest
        : [
            ...rest,
            {
              quest_id: item.questId,
              day: item.day,
              status: item.status,
              updated_at: item.updatedAt,
            },
          ];
    }
    case 'deleteQuest':
      return logs.filter((l) => l.quest_id !== item.questId);
    default:
      return logs;
  }
};

export const applyToDayStarts = (starts: DayStart[], item: OutboxItem): DayStart[] =>
  item.kind === 'markDayStart' && !starts.some((s) => s.day === item.start.day)
    ? [...starts, item.start].sort((a, b) => a.day.localeCompare(b.day))
    : starts;
