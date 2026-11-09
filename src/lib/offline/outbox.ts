import {
  type DayStart,
  type InboxNote,
  type NoteComment,
  type NotePatch,
  type Quest,
  type QuestPatch,
  type QuestStatus,
  deleteInboxNote,
  deleteQuest,
  insertDayStart,
  insertInboxNote,
  insertNoteComment,
  insertQuest,
  setQuestStatus,
  updateInboxNote,
  updateNoteTags,
  updateQuest,
  uploadImage,
} from '../api';
import { isNetworkError } from './network';
import { deleteStored, readStored, readStoredByPrefix, writeStored } from './storage';

/**
 * Changes made in the app, kept until the server has them. Every change goes
 * through here, online or not: online it is sent right away, offline it waits
 * in IndexedDB and is sent once the connection is back.
 */
export type OutboxChange =
  /** With `image_path` set, the image waits under uploadKey() and goes first. */
  | { kind: 'addNote'; note: InboxNote }
  | { kind: 'updateNote'; noteId: string; patch: NotePatch }
  | { kind: 'setTags'; noteId: string; tags: string[] }
  | { kind: 'addComment'; noteId: string; comment: NoteComment }
  | { kind: 'deleteNote'; noteId: string; imagePath: string | null }
  | { kind: 'addQuest'; quest: Quest }
  | { kind: 'updateQuest'; questId: string; patch: QuestPatch }
  | { kind: 'deleteQuest'; questId: string }
  /** null makes the quest available again on that day. */
  | {
      kind: 'setQuestStatus';
      questId: string;
      day: string;
      status: QuestStatus | null;
      updatedAt: string;
    }
  | { kind: 'markDayStart'; start: DayStart };

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

// Items that left the queue in this page load. The saved queue being loaded
// may still hold them when the delete from IndexedDB hasn't finished yet;
// likewise the item still being sent (see load()).
const removedIds = new Set<string>();

const listeners = new Set<() => void>();
const appliedListeners = new Set<(item: OutboxItem) => void>();

// One key per item, so tabs adding changes at the same time don't overwrite
// each other's queue.
const prefix = (user: string) => `${user}:outbox:`;

/** Where an image waits until its entry is on the server; kept on sign-out. */
export const uploadPrefix = (user: string) => `${user}:upload:`;
const uploadKey = (user: string, noteId: string) => `${uploadPrefix(user)}${noteId}`;

/** Images seen on this device, so they open offline. */
export const imageCacheKey = (user: string, path: string) => `${user}:image:${path}`;

/** The note or quest an item changes, e.g. 'note:<id>'; null for neither. */
const targetOf = (item: OutboxItem): string | null => {
  switch (item.kind) {
    case 'addNote':
      return `note:${item.note.id}`;
    case 'updateNote':
    case 'setTags':
    case 'addComment':
    case 'deleteNote':
      return `note:${item.noteId}`;
    case 'addQuest':
      return `quest:${item.quest.id}`;
    case 'updateQuest':
    case 'deleteQuest':
    case 'setQuestStatus':
      return `quest:${item.questId}`;
    case 'markDayStart':
      return null;
  }
};

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
  removedIds.add(item.id);
  setState({ items: state.items.filter((i) => i !== item) });
  if (userId) deleteStored(prefix(userId) + item.id);
};

/** A queued item that hasn't started sending yet. */
const waiting = <K extends OutboxItem['kind']>(
  kind: K,
  match: (i: Extract<OutboxItem, { kind: K }>) => boolean,
) =>
  state.items.find(
    (i): i is Extract<OutboxItem, { kind: K }> =>
      i !== inFlight && i.kind === kind && match(i as Extract<OutboxItem, { kind: K }>),
  );

// Retried after a lost response, an insert finds its row already there.
const ignoreDuplicate = async (request: Promise<void>) => {
  try {
    await request;
  } catch (e) {
    if ((e as { code?: string }).code !== '23505') throw e;
  }
};

const sendNote = async (owner: string, note: InboxNote) => {
  if (note.image_path) {
    const key = uploadKey(owner, note.id);
    const image = await readStored<Blob>(key);
    // Without the image (lost local storage) the entry is still worth keeping.
    if (image) await uploadImage(note.image_path, image);
    else if (note.body.trim()) note = { ...note, image_path: null };
    else throw new Error('изображение потерялось на устройстве');
    await ignoreDuplicate(insertInboxNote(note));
    await deleteStored(key);
    return;
  }
  await ignoreDuplicate(insertInboxNote(note));
};

const send = (owner: string, item: OutboxItem): Promise<void> => {
  switch (item.kind) {
    case 'addNote':
      return sendNote(owner, item.note);
    case 'updateNote':
      return updateInboxNote(item.noteId, item.patch);
    case 'setTags':
      return updateNoteTags(item.noteId, item.tags);
    case 'addComment':
      return ignoreDuplicate(insertNoteComment(item.noteId, item.comment));
    case 'deleteNote':
      return deleteInboxNote(item.noteId, item.imagePath);
    case 'addQuest':
      return ignoreDuplicate(insertQuest(item.quest));
    case 'updateQuest':
      return updateQuest(item.questId, item.patch);
    case 'deleteQuest':
      return deleteQuest(item.questId);
    case 'setQuestStatus':
      return setQuestStatus(
        item.status === null
          ? { quest_id: item.questId, day: item.day, status: null }
          : {
              quest_id: item.questId,
              day: item.day,
              status: item.status,
              updated_at: item.updatedAt,
            },
      );
    case 'markDayStart':
      // The first start of the day wins; later ones are no-ops.
      return ignoreDuplicate(insertDayStart(item.start));
  }
};

const labels: Record<OutboxItem['kind'], string> = {
  addNote: 'запись',
  updateNote: 'изменения записи',
  setTags: 'теги',
  addComment: 'комментарий',
  deleteNote: 'удаление записи',
  addQuest: 'квест',
  updateQuest: 'изменения квеста',
  deleteQuest: 'удаление квеста',
  setQuestStatus: 'статус квеста',
  markDayStart: 'начало дня',
};

const describe = (item: OutboxItem, e: unknown) =>
  `Не удалось сохранить ${labels[item.kind]}: ${(e as Error).message ?? e}`;

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
        await send(owner, item);
        for (const l of appliedListeners) l(item);
      } catch (e) {
        if (isNetworkError(e)) {
          // A reload of the queue meanwhile left it out (see load()); it is
          // still saved, so just put it back in front.
          if (userId === owner && !state.items.includes(item)) {
            setState({ items: [item, ...state.items] });
          }
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

/**
 * Folds a change into ones still waiting where that makes sense. Returns true
 * when nothing more needs to be queued.
 */
const absorb = (item: OutboxItem): boolean => {
  switch (item.kind) {
    case 'updateNote':
    case 'setTags': {
      const pending = waiting('addNote', (i) => i.note.id === item.noteId);
      if (pending) {
        // The entry isn't on the server yet: send it with these changes.
        const note =
          item.kind === 'setTags'
            ? { ...pending.note, tags: item.tags }
            : { ...pending.note, ...item.patch };
        put({ ...pending, note }, pending);
        return true;
      }
      if (item.kind === 'setTags') {
        // Only the latest tag set matters.
        const stale = waiting('setTags', (i) => i.noteId === item.noteId);
        if (stale) remove(stale);
      } else {
        const stale = waiting('updateNote', (i) => i.noteId === item.noteId);
        if (stale) {
          remove(stale);
          item.patch = { ...stale.patch, ...item.patch };
        }
      }
      return false;
    }
    case 'updateQuest': {
      const pending = waiting('addQuest', (i) => i.quest.id === item.questId);
      if (pending) {
        put({ ...pending, quest: { ...pending.quest, ...item.patch } }, pending);
        return true;
      }
      const stale = waiting('updateQuest', (i) => i.questId === item.questId);
      if (stale) {
        remove(stale);
        item.patch = { ...stale.patch, ...item.patch };
      }
      return false;
    }
    case 'setQuestStatus': {
      // Only the latest status for that day matters.
      const stale = waiting(
        'setQuestStatus',
        (i) => i.questId === item.questId && i.day === item.day,
      );
      if (stale) remove(stale);
      return false;
    }
    case 'deleteNote':
    case 'deleteQuest': {
      // Changes still waiting are pointless now. Something that never reached
      // the server needs no delete either.
      const target = targetOf(item);
      const neverSent =
        item.kind === 'deleteNote'
          ? waiting('addNote', (i) => i.note.id === item.noteId)
          : waiting('addQuest', (i) => i.quest.id === item.questId);
      for (const stale of state.items) {
        if (stale !== inFlight && targetOf(stale) === target) remove(stale);
      }
      if (neverSent && item.kind === 'deleteNote' && userId) {
        deleteStored(uploadKey(userId, item.noteId));
      }
      return Boolean(neverSent);
    }
    default:
      return false;
  }
};

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
    const fresh = stored.filter(
      (i) => !known.has(i.id) && !removedIds.has(i.id) && i.id !== inFlight?.id,
    );
    const items = [...fresh, ...state.items].sort(
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
    const item = { ...change, id: crypto.randomUUID(), at: Date.now() } as OutboxItem;
    if (absorb(item)) return;
    put(item);
    sync();
  },

  /**
   * Queues a new entry with an image. The image is saved on this device first,
   * so it survives a reload before the upload.
   */
  addNoteWithImage: async (note: InboxNote, image: Blob) => {
    if (!userId) throw new Error('not signed in');
    const owner = userId;
    await writeStored(uploadKey(owner, note.id), image);
    // Shown from the cache right away, before and after the upload.
    if (note.image_path) await writeStored(imageCacheKey(owner, note.image_path), image);
    if (userId !== owner) return;
    outbox.enqueue({ kind: 'addNote', note });
  },

  dismissError: () => setState({ error: null }),
};
