import { useCallback, useEffect, useState } from 'react';
import type { VaultKey } from '../lib/vault/crypto';
import { loadVaultKey, saveVaultKey } from '../lib/vault/keyStore';

export type VaultKeyState =
  | { status: 'loading' }
  /** This device has no key, or one that doesn't match the account's. */
  | { status: 'missing' }
  | { status: 'ready'; vaultKey: VaultKey };

/** The vault key kept on this device, checked against the account's fingerprint. */
export const useVaultKey = (userId: string, fingerprint: string | null) => {
  const [state, setState] = useState<VaultKeyState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    loadVaultKey(userId).then((vaultKey) => {
      if (cancelled) return;
      setState(
        vaultKey && vaultKey.fingerprint === fingerprint
          ? { status: 'ready', vaultKey }
          : { status: 'missing' },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [userId, fingerprint]);

  const accept = useCallback(
    async (vaultKey: VaultKey) => {
      await saveVaultKey(userId, vaultKey);
      setState({ status: 'ready', vaultKey });
    },
    [userId],
  );

  return { state, accept };
};
