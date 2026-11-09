import { clear, createStore, del, delMany, get, getMany, keys, set } from 'idb-keyval';

// IndexedDB can be unavailable (private windows, blocked storage), and then
// idb-keyval may throw synchronously as well as reject. The app then just
// works without offline data.
// The database keeps its first name so data on existing devices stays.
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

/** Deletes keys starting with `prefix`, except those starting with one of `keepPrefixes`. */
export const clearStored = async (prefix: string, keepPrefixes: string[] = []): Promise<void> => {
  await safely(async () => {
    const doomed = (await keysWithPrefix(prefix)).filter(
      (k) => !keepPrefixes.some((keep) => String(k).startsWith(keep)),
    );
    await delMany(doomed, store);
  });
};

// Bump when data kept on devices by an older release must not be used any
// more. Version 2: the encrypted Vault is gone and server data was reset, so
// its key, encrypted cache and queued uploads are dropped.
const LOCAL_DATA_VERSION = 2;
const versionKey = 'local-data-version';

/** Clears this device's offline data once if an older release wrote it. */
export const migrateLocalData = async (): Promise<void> => {
  await safely(async () => {
    if ((await get<number>(versionKey, store)) === LOCAL_DATA_VERSION) return;
    await clear(store);
    await set(versionKey, LOCAL_DATA_VERSION, store);
  });
};
