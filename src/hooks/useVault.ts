import { useSyncExternalStore } from 'react';
import { vault } from '../lib/vault/vault';

/** The open vault's decrypted notes and comments. */
export const useVault = () => useSyncExternalStore(vault.subscribe, vault.getSnapshot);
