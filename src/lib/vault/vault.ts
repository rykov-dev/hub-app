import { isNetworkError } from '../offline/network';
import { outbox, pendingPaths } from '../offline/outbox';
import { deleteStored, readStoredByPrefix, writeStored } from '../offline/storage';
import { decryptObject, encryptObject } from './crypto';
import {
  type Note,
  type NoteComment,
  commentPath,
  isCommentOf,
  isNotePath,
  notePath,
} from './model';
import { downloadObject, listRemote } from './remote';

/**
 * The user's vault on this device. A local mirror of the encrypted objects
 * (IndexedDB) is the source of truth for the screen: changes land in it at
 * once and go to the server through the outbox; pulling brings in what other
 * devices changed. Decrypted data lives only in memory.
 */

type MirrorEntry = {
  path: string;
  data: Uint8Array;
  /** Server's updated_at of the copy we have; null for a local change. */
  remoteAt: string | null;
};

export type VaultState = {
  ready: boolean;
  notes: Note[];
  /** By note id, oldest first. */
  comments: Map<string, NoteComment[]>;
  pulling: boolean;
  /** Objects that could not be decrypted (another key, damaged). */
  unreadable: number;
  error: string | null;
};

const PULL_INTERVAL_MS = 2 * 60_000;

const empty: VaultState = {
  ready: false,
  notes: [],
  comments: new Map(),
  pulling: false,
  unreadable: 0,
  error: null,
};

let state = empty;
let session: { userId: string; key: CryptoKey } | null = null;
// Decrypted objects by path.
let objects = new Map<string, Note | NoteComment>();
let mirror = new Map<string, MirrorEntry>();
let unreadable = new Set<string>();
let pullTimer: ReturnType<typeof setInterval> | undefined;
let stopDrained: (() => void) | undefined;

const listeners = new Set<() => void>();

const mirrorKey = (userId: string, path: string) => `${userId}:vault:${path}`;

const setState = (patch: Partial<VaultState>) => {
  state = { ...state, ...patch };
  for (const l of listeners) l();
};

const publish = () => {
  const notes: Note[] = [];
  const comments = new Map<string, NoteComment[]>();
  for (const [path, value] of objects) {
    if (isNotePath(path)) notes.push(value as Note);
  }
  const noteIds = new Set(notes.map((n) => n.id));
  for (const [path, value] of objects) {
    const comment = value as NoteComment;
    // Comments of a note deleted on another device are not shown.
    if (isNotePath(path) || !noteIds.has(comment.noteId)) continue;
    comments.set(comment.noteId, [...(comments.get(comment.noteId) ?? []), comment]);
  }
  notes.sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const list of comments.values()) list.sort((a, b) => a.created_at.localeCompare(b.created_at));
  setState({ notes, comments, unreadable: unreadable.size });
};

const decryptInto = async (key: CryptoKey, entry: MirrorEntry) => {
  try {
    objects.set(entry.path, await decryptObject(key, entry.path, entry.data));
    unreadable.delete(entry.path);
  } catch {
    objects.delete(entry.path);
    unreadable.add(entry.path);
  }
};

const store = (userId: string, entry: MirrorEntry) => {
  mirror.set(entry.path, entry);
  writeStored(mirrorKey(userId, entry.path), entry);
};

const drop = (userId: string, path: string) => {
  mirror.delete(path);
  objects.delete(path);
  unreadable.delete(path);
  deleteStored(mirrorKey(userId, path));
};

/** Brings in changes made on other devices. Local changes not yet sent win. */
const pull = async () => {
  const current = session;
  if (!current || state.pulling || !navigator.onLine) return;
  setState({ pulling: true });
  try {
    const remote = await listRemote(current.userId);
    if (session !== current) return;
    const pending = pendingPaths(outbox.getSnapshot().items);
    const remotePaths = new Set(remote.map((o) => o.path));

    for (const { path, updatedAt } of remote) {
      if (pending.has(path) || mirror.get(path)?.remoteAt === updatedAt) continue;
      const data = await downloadObject(current.userId, path);
      if (session !== current || pendingPaths(outbox.getSnapshot().items).has(path)) continue;
      const entry = { path, data, remoteAt: updatedAt };
      store(current.userId, entry);
      await decryptInto(current.key, entry);
    }
    // Gone from the server and not changed here: deleted on another device.
    for (const path of [...mirror.keys()]) {
      if (!remotePaths.has(path) && !pending.has(path)) drop(current.userId, path);
    }
    publish();
    setState({ error: null });
  } catch (e) {
    if (session === current && !isNetworkError(e)) {
      setState({ error: `Не удалось получить данные: ${(e as Error).message ?? e}` });
    }
  } finally {
    if (session === current) setState({ pulling: false });
  }
};

const write = async (path: string, value: Note | NoteComment) => {
  if (!session) throw new Error('Vault is locked');
  const data = await encryptObject(session.key, path, value);
  store(session.userId, { path, data, remoteAt: null });
  objects.set(path, value);
  publish();
  outbox.enqueue({ kind: 'put', path, data });
};

const onVisible = () => {
  if (document.visibilityState === 'visible') pull();
};
const onOnline = () => pull();

export const vault = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => state,

  /** Shows what this device has right away, then syncs with the server. */
  open: async (userId: string, key: CryptoKey) => {
    vault.close();
    const current = { userId, key };
    session = current;
    const entries = await readStoredByPrefix<MirrorEntry>(`${userId}:vault:`);
    if (session !== current) return;
    for (const entry of entries) {
      mirror.set(entry.path, entry);
      await decryptInto(key, entry);
    }
    if (session !== current) return;
    publish();
    setState({ ready: true });

    await outbox.load(userId);
    if (session !== current) return;
    pull();
    pullTimer = setInterval(pull, PULL_INTERVAL_MS);
    // Own uploads get the server's timestamps, so they aren't downloaded again later.
    stopDrained = outbox.onDrained(pull);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
  },

  close: () => {
    session = null;
    objects = new Map();
    mirror = new Map();
    unreadable = new Set();
    clearInterval(pullTimer);
    stopDrained?.();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    }
    outbox.unload();
    state = empty;
    for (const l of listeners) l();
  },

  pull,

  /** Ids and timestamps are created here, so notes made offline keep them. */
  addNote: (body: string, note?: Partial<Note>) => {
    const value: Note = {
      id: crypto.randomUUID(),
      body,
      tags: [],
      created_at: new Date().toISOString(),
      ...note,
    };
    return write(notePath(value.id), value);
  },

  setTags: (noteId: string, tags: string[]) => {
    const note = objects.get(notePath(noteId)) as Note | undefined;
    if (!note) return Promise.resolve();
    return write(notePath(noteId), { ...note, tags });
  },

  addComment: (noteId: string, body: string, comment?: Partial<NoteComment>) => {
    const value: NoteComment = {
      id: crypto.randomUUID(),
      noteId,
      body,
      created_at: new Date().toISOString(),
      ...comment,
    };
    return write(commentPath(noteId, value.id), value);
  },

  /** Removes the note with its comments. */
  deleteNote: (noteId: string) => {
    const current = session;
    if (!current) return;
    const paths = [notePath(noteId), ...[...mirror.keys()].filter((p) => isCommentOf(p, noteId))];
    for (const path of paths) drop(current.userId, path);
    publish();
    outbox.enqueue({ kind: 'remove', paths });
  },

  has: (path: string) => mirror.has(path),
};
