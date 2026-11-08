import {
  type InboxNote,
  type NoteComment,
  deleteInboxNote,
  insertInboxNote,
  insertNoteComment,
  updateNoteTags,
} from '../api';
import { isNetworkError } from './network';
import { deleteStored, readStoredByPrefix, writeStored } from './storage';

/**
 * Changes made in the app, kept until the server has them. Every change goes
 * through here, online or not: online it is sent right away, offline it waits
 * in IndexedDB and is sent once the connection is back.
 */
export type OutboxChange =
  | { kind: 'addNote'; note: InboxNote }
  | { kind: 'setTags'; noteId: string; tags: string[] }
  | { kind: 'addComment'; noteId: string; comment: NoteComment }
  | { kind: 'deleteNote'; noteId: string };

export type OutboxItem = OutboxChange & {
  id: string;
  /** Enqueue time; items are sent in this order. */
  at: number;
};

export type OutboxState = {
  items: OutboxItem[];
  syncing: boolean;
  /** Last change the server rejected; it was dropped. */
  error: string | null;
};

const RETRY_MS = 30_000;

let userId: string | null = null;
let state: OutboxState = { items: [], syncing: false, error: null };
// The item being sent; it must not be changed in place while in flight.
let inFlight: OutboxItem | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

const listeners = new Set<() => void>();
const appliedListeners = new Set<(item: OutboxItem) => void>();

// One key per item, so tabs adding changes at the same time don't overwrite
// each other's queue.
const prefix = (user: string) => `${user}:outbox:`;

const setState = (patch: Partial<OutboxState>) => {
  state = { ...state, ...patch };
  for (const l of listeners) l();
};

const put = (item: OutboxItem, replacing?: OutboxItem) => {
  const items = replacing
    ? state.items.map((i) => (i === replacing ? item : i))
    : [...state.items, item];
  setState({ items });
  if (userId) writeStored(prefix(userId) + item.id, item);
};

const remove = (item: OutboxItem) => {
  setState({ items: state.items.filter((i) => i !== item) });
  if (userId) deleteStored(prefix(userId) + item.id);
};

// Retried after a lost response, an insert finds its row already there.
const ignoreDuplicate = async (request: Promise<void>) => {
  try {
    await request;
  } catch (e) {
    if ((e as { code?: string }).code !== '23505') throw e;
  }
};

const send = (item: OutboxItem): Promise<void> => {
  switch (item.kind) {
    case 'addNote':
      return ignoreDuplicate(insertInboxNote(item.note));
    case 'setTags':
      return updateNoteTags(item.noteId, item.tags);
    case 'addComment':
      return ignoreDuplicate(insertNoteComment(item.noteId, item.comment));
    case 'deleteNote':
      return deleteInboxNote(item.noteId);
  }
};

const describe = (item: OutboxItem, e: unknown) => {
  const what = {
    addNote: 'заметку',
    setTags: 'теги',
    addComment: 'комментарий',
    deleteNote: 'удаление заметки',
  }[item.kind];
  return `Не удалось сохранить ${what}: ${(e as Error).message ?? e}`;
};

const sync = async () => {
  if (state.syncing || !userId || !navigator.onLine) return;
  clearTimeout(retryTimer);
  const owner = userId;
  setState({ syncing: true });
  try {
    while (userId === owner && state.items.length > 0) {
      const item = state.items[0];
      inFlight = item;
      try {
        await send(item);
        for (const l of appliedListeners) l(item);
      } catch (e) {
        if (isNetworkError(e)) {
          retryTimer = setTimeout(sync, RETRY_MS);
          break;
        }
        // The server rejected it; retrying won't change that.
        setState({ error: describe(item, e) });
      } finally {
        inFlight = null;
      }
      if (userId === owner) remove(item);
    }
  } finally {
    setState({ syncing: false });
  }
};

if (typeof window !== 'undefined') window.addEventListener('online', () => sync());

export const outbox = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => state,

  /** Called after the server accepted a change, before it leaves the queue. */
  onApplied: (listener: (item: OutboxItem) => void) => {
    appliedListeners.add(listener);
    return () => {
      appliedListeners.delete(listener);
    };
  },

  /** Loads the user's queue saved on this device and starts sending it. */
  load: async (id: string) => {
    userId = id;
    const stored = await readStoredByPrefix<OutboxItem>(prefix(id));
    if (userId !== id) return;
    // Keep anything enqueued while the saved queue was loading.
    const known = new Set(state.items.map((i) => i.id));
    const items = [...stored.filter((i) => !known.has(i.id)), ...state.items].sort(
      (a, b) => a.at - b.at,
    );
    setState({ items, error: null });
    sync();
  },

  unload: () => {
    userId = null;
    clearTimeout(retryTimer);
    setState({ items: [], error: null });
  },

  enqueue: (change: OutboxChange) => {
    const item: OutboxItem = { ...change, id: crypto.randomUUID(), at: Date.now() };
    if (item.kind === 'setTags') {
      const pendingNote = state.items.find(
        (i) => i !== inFlight && i.kind === 'addNote' && i.note.id === item.noteId,
      );
      if (pendingNote?.kind === 'addNote') {
        // The note isn't on the server yet: send it with these tags.
        put({ ...pendingNote, note: { ...pendingNote.note, tags: item.tags } }, pendingNote);
        return;
      }
      // Only the latest tag set matters.
      for (const stale of state.items) {
        if (stale !== inFlight && stale.kind === 'setTags' && stale.noteId === item.noteId) {
          remove(stale);
        }
      }
    }
    if (item.kind === 'deleteNote') {
      // Changes to the note still waiting are pointless now. A note that never
      // reached the server needs no delete either.
      const noteOf = (i: OutboxItem) =>
        i.kind === 'addNote' ? i.note.id : i.kind === 'deleteNote' ? null : i.noteId;
      const neverSent = state.items.some(
        (i) => i !== inFlight && i.kind === 'addNote' && i.note.id === item.noteId,
      );
      for (const stale of state.items) {
        if (stale !== inFlight && noteOf(stale) === item.noteId) remove(stale);
      }
      if (neverSent) return;
    }
    put(item);
    sync();
  },

  dismissError: () => setState({ error: null }),
};
