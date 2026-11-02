import { deleteStored, readStored, writeStored } from '../offline/storage';
import { type Bytes, type VaultKey, restoreVaultKey } from './crypto';

// The key stays on the device it was loaded on, so the vault opens offline.
// Signing out removes it with the rest of the user's local data.
const storageKey = (userId: string) => `${userId}:vault-key`;

export const loadVaultKey = async (userId: string): Promise<VaultKey | null> => {
  const raw = await readStored<Bytes>(storageKey(userId));
  return raw ? restoreVaultKey(raw) : null;
};

export const saveVaultKey = (userId: string, vaultKey: VaultKey) =>
  writeStored(storageKey(userId), vaultKey.raw);

export const forgetVaultKey = (userId: string) => deleteStored(storageKey(userId));
