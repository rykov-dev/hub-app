import { useEffect, useState } from 'react';
import { useOnline } from '../hooks/useOnline';
import { setVaultKey } from '../lib/api';
import { type VaultKey, downloadKeyFile, generateVaultKey } from '../lib/vault/crypto';
import { Loader } from './Loader';

type Props = {
  account: string;
  /** Called once the key is registered for the account. */
  onReady: (vaultKey: VaultKey) => Promise<void>;
};

/**
 * First start: creates the vault key on this device and has the user save it
 * as a file. The server only learns the key's fingerprint.
 */
export const VaultSetup = ({ account, onReady }: Props) => {
  const online = useOnline();
  const [vaultKey, setVaultKeyState] = useState<VaultKey | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    generateVaultKey().then(setVaultKeyState);
  }, []);

  if (!vaultKey) return <Loader inline />;

  const download = () => {
    downloadKeyFile(vaultKey, account);
    setDownloaded(true);
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await setVaultKey(vaultKey.fingerprint);
      await onReady(vaultKey);
    } catch (e) {
      const message = (e as Error).message ?? String(e);
      setError(
        message.includes('vault_key_already_set')
          ? 'Ключ для этого аккаунта уже создан на другом устройстве. Обнови страницу и загрузи его файл.'
          : message,
      );
      setBusy(false);
    }
  };

  return (
    <section className="card area-inbox vault">
      <h2>Ключ шифрования</h2>
      <p>
        Заметки и комментарии шифруются на этом устройстве ключом, который есть только у тебя.
        Сервер хранит только зашифрованные данные и не может их прочитать.
      </p>
      <p className="muted">
        Сохрани файл ключа в надёжном месте: в менеджере паролей или на флешке. Он нужен, чтобы
        открыть заметки на другом устройстве или после выхода. <strong>Без ключа заметки не
        восстановить никак.</strong>
      </p>
      <p className="muted small vault-fingerprint">Отпечаток: {vaultKey.fingerprint}</p>
      <button type="button" className="btn" onClick={download}>
        Скачать файл ключа
      </button>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={!downloaded}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        Я сохранил файл ключа
      </label>
      {!online && <p className="muted small">Нужна сеть, чтобы привязать ключ к аккаунту.</p>}
      {error && <p className="error">{error}</p>}
      <button
        type="button"
        className="btn btn-primary"
        disabled={!confirmed || !online || busy}
        onClick={finish}
      >
        {busy ? 'Сохраняю…' : 'Продолжить'}
      </button>
    </section>
  );
};
