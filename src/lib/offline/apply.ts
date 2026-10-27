import type { InboxNote, NoteComment } from '../api';
import type { OutboxItem } from './outbox';

// Applying queued changes to server data gives what the user should see: used
// for pending changes on screen, and for synced ones until the next fetch.

export const applyToNotes = (notes: InboxNote[], item: OutboxItem): InboxNote[] => {
  switch (item.kind) {
    case 'addNote':
      return notes.some((n) => n.id === item.note.id) ? notes : [item.note, ...notes];
    case 'setTags':
      return notes.map((n) => (n.id === item.noteId ? { ...n, tags: item.tags } : n));
    default:
      return notes;
  }
};

export const applyToNote = (note: InboxNote | null, id: string, item: OutboxItem) => {
  if (item.kind === 'addNote' && item.note.id === id) return note ?? item.note;
  if (item.kind === 'setTags' && item.noteId === id && note) return { ...note, tags: item.tags };
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
