import { type ChangeEvent, type FormEvent, useState } from 'react';
import { type VaultKey, parseKeyFile } from '../lib/vault/crypto';

type Props = {
  fingerprint: string;
  onReady: (vaultKey: VaultKey) => Promise<void>;
};

/** A device without the key: the user loads the key file or pastes its text. */
export const VaultUnlock = ({ fingerprint, onReady }: Props) => {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const tryKey = async (input: string) => {
    setError(null);
    try {
      const vaultKey = await parseKeyFile(input);
      if (vaultKey.fingerprint !== fingerprint) {
        setError('Это ключ от другого аккаунта: отпечаток не совпадает.');
        return;
      }
      await onReady(vaultKey);
    } catch (e) {
      setError((e as Error).message ?? String(e));
    }
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) tryKey(await file.text());
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) tryKey(text);
  };

  return (
    <section className="card area-inbox vault">
      <h2>Открой заметки ключом</h2>
      <p className="muted">
        Заметки зашифрованы. Загрузи файл ключа, который ты сохранил при настройке, или вставь его
        текст.
      </p>
      <p className="muted small vault-fingerprint">Нужен ключ с отпечатком {fingerprint}</p>
      <label className="btn btn-primary file-button">
        Выбрать файл ключа
        <input type="file" accept=".key,text/plain" onChange={onFile} className="visually-hidden" />
      </label>
      <form className="login-form" onSubmit={onSubmit}>
        <textarea
          className="input textarea-small"
          placeholder="-----BEGIN DEITY VAULT KEY-----"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Текст ключа"
          spellCheck={false}
        />
        <button type="submit" className="btn" disabled={!text.trim()}>
          Открыть
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
};
