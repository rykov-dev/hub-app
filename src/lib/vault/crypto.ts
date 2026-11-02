/**
 * The user's vault key and encryption of vault objects (Web Crypto).
 *
 * The key is 256 random bits created on the device and handed to the user as
 * a key file, like an SSH key. Objects are AES-256-GCM encrypted; the object's
 * path is authenticated with it, so a ciphertext can't be passed off as
 * another note.
 */

const FILE_HEADER = '-----BEGIN DEITY VAULT KEY-----';
const FILE_FOOTER = '-----END DEITY VAULT KEY-----';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const FORMAT_VERSION = 1;

// Web Crypto takes buffers backed by a plain ArrayBuffer.
export type Bytes = Uint8Array<ArrayBuffer>;

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** 'SHA256:<base64 without padding>', the format ssh-keygen prints. */
const fingerprintOf = async (raw: Bytes) => {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', raw));
  return `SHA256:${toBase64(hash).replace(/=+$/, '')}`;
};

export type VaultKey = {
  key: CryptoKey;
  fingerprint: string;
  /** Kept so the key file can be downloaded again from a device that has it. */
  raw: Bytes;
};

const importRaw = async (raw: Bytes): Promise<VaultKey> => ({
  key: await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']),
  fingerprint: await fingerprintOf(raw),
  raw,
});

export const generateVaultKey = () => importRaw(crypto.getRandomValues(new Uint8Array(KEY_BYTES)));

export const restoreVaultKey = (raw: Bytes) => importRaw(raw);

/** Text of the key file the user keeps. */
export const keyFileText = (vaultKey: VaultKey, account: string) =>
  [
    FILE_HEADER,
    `Account: ${account}`,
    `Fingerprint: ${vaultKey.fingerprint}`,
    '',
    toBase64(vaultKey.raw),
    FILE_FOOTER,
    '',
  ].join('\n');

/** Reads a key file (or just its base64 line, pasted). Throws if it isn't one. */
export const parseKeyFile = async (text: string): Promise<VaultKey> => {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('-----') && !l.includes(':'));
  let raw: Bytes | null = null;
  try {
    raw = lines.length === 1 ? fromBase64(lines[0]) : null;
  } catch {
    raw = null;
  }
  if (!raw || raw.length !== KEY_BYTES) throw new Error('Это не файл ключа Deity.');
  return importRaw(raw);
};

/** version (1 byte) | IV (12 bytes) | AES-GCM ciphertext with tag. */
export const encryptObject = async (key: CryptoKey, path: string, value: unknown) => {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(path) },
    key,
    encoder.encode(JSON.stringify(value)),
  );
  const out = new Uint8Array(1 + IV_BYTES + ciphertext.byteLength);
  out[0] = FORMAT_VERSION;
  out.set(iv, 1);
  out.set(new Uint8Array(ciphertext), 1 + IV_BYTES);
  return out;
};

/** Throws if the data was encrypted with another key, for another path, or changed. */
export const decryptObject = async <T>(key: CryptoKey, path: string, data: Uint8Array): Promise<T> => {
  if (data[0] !== FORMAT_VERSION) throw new Error(`Unknown vault object format ${data[0]}`);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: data.slice(1, 1 + IV_BYTES), additionalData: encoder.encode(path) },
    key,
    data.slice(1 + IV_BYTES),
  );
  return JSON.parse(decoder.decode(plaintext)) as T;
};

/** Saves the key file through the browser's download. */
export const downloadKeyFile = (vaultKey: VaultKey, account: string) => {
  const url = URL.createObjectURL(new Blob([keyFileText(vaultKey, account)], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'deity-vault.key';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
