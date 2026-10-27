import { createStore, del, delMany, get, getMany, keys, set } from 'idb-keyval';

// IndexedDB can be unavailable (private windows, blocked storage), and then
// idb-keyval may throw synchronously as well as reject. The app then just
// works without offline data.
const store = createStore('monetki', 'kv');

const safely = async <T>(operation: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await operation();
  } catch {
    return undefined;
  }
};

export const readStored = <T>(key: string): Promise<T | undefined> =>
  safely(() => get<T>(key, store));

export const writeStored = async (key: string, value: unknown): Promise<void> => {
  await safely(() => set(key, value, store));
};

export const deleteStored = async (key: string): Promise<void> => {
  await safely(() => del(key, store));
};

const keysWithPrefix = async (prefix: string) =>
  (await keys(store)).filter((k) => String(k).startsWith(prefix));

export const readStoredByPrefix = async <T>(prefix: string): Promise<T[]> => {
  const values = await safely(async () => getMany<T>(await keysWithPrefix(prefix), store));
  return (values ?? []).filter((v): v is T => v !== undefined);
};

/** Deletes keys starting with `prefix`, except those starting with `keepPrefix`. */
export const clearStored = async (prefix: string, keepPrefix?: string): Promise<void> => {
  await safely(async () => {
    const doomed = (await keysWithPrefix(prefix)).filter(
      (k) => !(keepPrefix && String(k).startsWith(keepPrefix)),
    );
    await delMany(doomed, store);
  });
};
