import { removeObjects, uploadObject } from '../vault/remote';
import { isNetworkError } from './network';
import { deleteStored, readStoredByPrefix, writeStored } from './storage';

/**
 * Changes to the vault, kept until the server has them. Every change goes
 * through here, online or not: online it is sent right away, offline it waits
 * in IndexedDB and is sent once the connection is back. Items carry objects
 * already encrypted, so nothing readable is stored or sent.
 */
export type OutboxChange =
  | { kind: 'put'; path: string; data: Uint8Array }
  | { kind: 'remove'; paths: string[] };

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
// The item being sent; it must not be changed or dropped while in flight.
let inFlight: OutboxItem | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

const listeners = new Set<() => void>();
const drainedListeners = new Set<() => void>();

// One key per item, so tabs adding changes at the same time don't overwrite
// each other's queue.
export const outboxPrefix = (user: string) => `${user}:vault-outbox:`;

const setState = (patch: Partial<OutboxState>) => {
  state = { ...state, ...patch };
  for (const l of listeners) l();
};

const put = (item: OutboxItem) => {
  setState({ items: [...state.items, item] });
  if (userId) writeStored(outboxPrefix(userId) + item.id, item);
};

const remove = (item: OutboxItem) => {
  setState({ items: state.items.filter((i) => i !== item) });
  if (userId) deleteStored(outboxPrefix(userId) + item.id);
};

const send = (owner: string, item: OutboxItem): Promise<void> =>
  item.kind === 'put' ? uploadObject(owner, item.path, item.data) : removeObjects(owner, item.paths);

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
      } catch (e) {
        if (isNetworkError(e)) {
          retryTimer = setTimeout(sync, RETRY_MS);
          return;
        }
        // The server rejected it; retrying won't change that.
        setState({ error: `Не удалось сохранить изменение: ${(e as Error).message ?? e}` });
      } finally {
        inFlight = null;
      }
      if (userId === owner) remove(item);
    }
  } finally {
    setState({ syncing: false });
  }
  if (userId === owner && state.items.length === 0) for (const l of drainedListeners) l();
};

if (typeof window !== 'undefined') window.addEventListener('online', () => sync());

/** Paths with changes still waiting to be sent: local data is newer there. */
export const pendingPaths = (items: OutboxItem[]) =>
  new Set(items.flatMap((i) => (i.kind === 'put' ? [i.path] : i.paths)));

export const outbox = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => state,

  /** Called each time everything queued has reached the server. */
  onDrained: (listener: () => void) => {
    drainedListeners.add(listener);
    return () => {
      drainedListeners.delete(listener);
    };
  },

  /** Loads the user's queue saved on this device and starts sending it. */
  load: async (id: string) => {
    userId = id;
    const stored = await readStoredByPrefix<OutboxItem>(outboxPrefix(id));
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
    // Only the latest version of an object matters, and nothing of a removed one.
    const replaced = new Set(item.kind === 'put' ? [item.path] : item.paths);
    for (const stale of state.items) {
      if (stale !== inFlight && stale.kind === 'put' && replaced.has(stale.path)) remove(stale);
    }
    put(item);
    sync();
  },

  sync,

  dismissError: () => setState({ error: null }),
};
