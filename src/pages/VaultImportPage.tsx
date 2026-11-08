import { type ChangeEvent, useState } from 'react';
import { Link } from 'react-router';
import { useAppContext } from '../layouts/AppLayout';
import { importLegacyVault, parseLegacyVaultKey, type LegacyVaultImportResult } from '../lib/legacyVaultImport';
import { supabase } from '../lib/supabase';

/** Explicit, one-time migration. This page does not store the key anywhere. */
export const VaultImportPage = () => {
  const { profile } = useAppContext();
  const [keyText, setKeyText] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LegacyVaultImportResult | null>(null);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) setKeyText(await file.text());
  };

  const run = async () => {
    if (!keyText.trim() || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const { key, fingerprint } = await parseLegacyVaultKey(keyText);
      const { data, error: profileError } = await supabase
        .from('profiles').select('vault_key_fingerprint').eq('id', profile.id).single();
      if (profileError) throw profileError;
      if (!data?.vault_key_fingerprint) throw new Error('У аккаунта нет старого Vault Key.');
      if (fingerprint !== data.vault_key_fingerprint) throw new Error('Ключ не соответствует аккаунту.');
      setProgress('Читаем старый Vault...');
      const imported = await importLegacyVault(profile.id, key, setProgress);
      setResult(imported);
      setProgress('Перенос завершён. Проверь заметки и комментарии в Inbox.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setKeyText('');
      setRunning(false);
    }
  };

  return (
    <section className="card area-inbox">
      <h2>Перенос заметок из Deity Vault</h2>
      <p className="muted">
        Заметки теперь доступны после входа через Google/GitHub без отдельного ключа.
        Если у тебя остались зашифрованные заметки, перенеси их один раз.
      </p>
      <p className="muted">
        Перед переносом синхронизируй старое устройство и сохрани резервную копию файла ключа.
        Зашифрованные оригиналы не удаляются. Повторный импорт пропускает уже существующие записи.
      </p>
      <label htmlFor="legacy-vault-key">Файл ключа старого Vault</label>
      <input id="legacy-vault-key" type="file" accept=".key,text/plain" onChange={onFile} disabled={running} />
      <textarea
        className="input textarea-small"
        value={keyText}
        onChange={(event) => setKeyText(event.target.value)}
        placeholder="Или вставь содержимое файла ключа"
        aria-label="Ключ старого Vault"
        spellCheck={false}
        disabled={running}
      />
      <button type="button" className="btn btn-primary" onClick={run} disabled={!keyText.trim() || running}>
        {running ? 'Переносим...' : 'Перенести заметки'}
      </button>
      {progress && <p role="status">{progress}</p>}
      {result && <p>Добавлено: {result.notes} заметок, {result.comments} комментариев. Уже существовали: {result.skipped}.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <Link to="/inbox" className="link">Открыть Inbox</Link>
    </section>
  );
};
