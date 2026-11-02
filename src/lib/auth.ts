import type { Session } from '@supabase/supabase-js';
import { outboxPrefix } from './offline/outbox';
import { clearAllStored, clearStored } from './offline/storage';
import { supabase } from './supabase';

/**
 * The session as last saved by supabase-js. Offline with an expired access
 * token the refresh fails and getSession() reports no session, although the
 * saved one becomes usable again once the connection is back.
 */
export const readStoredSession = (): Session | null => {
  try {
    // supabase-js keeps the session in localStorage under this key.
    const key = (supabase.auth as unknown as { storageKey: string }).storageKey;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
};

/**
 * Signs out and removes the user's data from this device, the vault key
 * included, except changes that haven't reached the server yet (they are
 * encrypted): they sync on the next sign-in, once the key is loaded again.
 */
export const signOut = async (userId: string) => {
  await supabase.auth.signOut();
  await clearStored(`${userId}:`, [outboxPrefix(userId), `${userId}:outbox:`]);
};

/**
 * Resets this device to a clean state when its auth key/session is gone.
 * Server data is intentionally untouched because there is no authenticated
 * identity to prove which account should be deleted.
 */
export const resetDeviceData = async (): Promise<void> => {
  try {
    const key = (supabase.auth as unknown as { storageKey: string }).storageKey;
    localStorage.removeItem(key);
  } catch {
    // localStorage can be unavailable; IndexedDB cleanup below is still useful.
  }

  await clearAllStored();
};
