import { type VaultKey, downloadKeyFile } from '../lib/vault/crypto';

type Props = {
  vaultKey: VaultKey;
  account: string;
  className?: string;
};

/** The vault key on this device; the file can be saved again, e.g. for a new phone. */
export const KeyCard = ({ vaultKey, account, className = '' }: Props) => (
  <section className={`card ${className}`}>
    <h2>Ключ шифрования</h2>
    <p className="muted small vault-fingerprint">{vaultKey.fingerprint}</p>
    <button type="button" className="btn" onClick={() => downloadKeyFile(vaultKey, account)}>
      Скачать файл ключа
    </button>
  </section>
);
