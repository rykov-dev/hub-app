import { supabase } from './supabase';
import type { InboxNote, NoteComment } from './api';

/**
 * One-time reader for Deity Vault v1. The normal app never encrypts notes.
 * Keep this isolated so an encrypted-at-rest backend can be introduced later.
 * Never upload, log, or persist the imported raw key.
 */
const decoder = new TextDecoder();
const NOTES = 'notes';
const COMMENTS = 'comments';
const PAGE_SIZE = 1000;

const base64Bytes = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export const parseLegacyVaultKey = async (value: string): Promise<{ key: CryptoKey; fingerprint: string }> => {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const encoded = lines.find((line) => !line.startsWith('-----') && !line.includes(':'));
  if (!encoded) throw new Error('В файле не найден ключ Vault.');
  let raw: Uint8Array;
  try {
    raw = base64Bytes(encoded);
  } catch {
    throw new Error('Неверный формат ключа Vault.');
  }
  if (raw.length !== 32) throw new Error('Неверная длина ключа Vault.');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', raw));
  const fingerprint = 'SHA256:' + btoa(String.fromCharCode(...digest)).replace(/=+$/, '');
  return {
    key: await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']),
    fingerprint,
  };
};

const decrypt = async <T>(key: CryptoKey, path: string, bytes: Uint8Array): Promise<T> => {
  if (bytes[0] !== 1 || bytes.length < 30) throw new Error('Неизвестный формат объекта Vault.');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.slice(1, 13), additionalData: new TextEncoder().encode(path) },
    key,
    bytes.slice(13),
  );
  return JSON.parse(decoder.decode(plaintext)) as T;
};

const listPaths = async (userId: string, directory: string): Promise<string[]> => {
  const paths: string[] = [];
  const bucket = supabase.storage.from('vault');
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await bucket.list(`${userId}/${directory}`, {
      limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    for (const object of data) {
      if (object.name.endsWith('.bin')) paths.push(`${directory}/${object.name}`);
    }
    if (data.length < PAGE_SIZE) return paths;
  }
};

const loadObject = async <T>(userId: string, path: string, key: CryptoKey): Promise<T> => {
  const { data, error } = await supabase.storage.from('vault').download(`${userId}/${path}`);
  if (error) throw error;
  return decrypt<T>(key, path, new Uint8Array(await data.arrayBuffer()));
};

export type LegacyVaultImportResult = {
  notes: number;
  comments: number;
  skipped: number;
};

/**
 * Import by stable IDs. Inserts are retriable (23505 = already imported).
 * Never replace existing plaintext records, nor delete encrypted originals.
 * Notes are imported first so comment foreign keys resolve.
 */
export const importLegacyVault = async (
  userId: string,
  key: CryptoKey,
  onProgress: (message: string) => void,
): Promise<LegacyVaultImportResult> => {
  const result = { notes: 0, comments: 0, skipped: 0 };
  const notes = await listPaths(userId, NOTES);
  const comments = await listPaths(userId, COMMENTS);
  for (const path of notes) {
    const value = await loadObject<InboxNote>(userId, path, key);
    if (!path.endsWith(`/${value.id}.bin`) || !value.id || !value.body) {
      throw new Error(`Некорректная заметка: ${path}`);
    }
    // Import through a dedicated RPC: ordinary inserts trigger coin rewards.
    const { data: inserted, error } = await supabase.rpc('import_legacy_vault_note', {
      p_id: value.id,
      p_body: value.body,
      p_tags: value.tags ?? [],
      p_created_at: value.created_at,
    });
    if (error) throw new Error(`Заметка ${value.id}: ${error.message}`);
    if (inserted) result.notes++;
    else result.skipped++;
    onProgress(`Заметки: ${result.notes + result.skipped} / ${notes.length}`);
  }
  for (const path of comments) {
    const value = await loadObject<NoteComment & { noteId: string }>(userId, path, key);
    if (!path.endsWith(`/${value.noteId}.${value.id}.bin`) || !value.body) {
      throw new Error(`Некорректный комментарий: ${path}`);
    }
    const { error } = await supabase.from('inbox_note_comments').insert({
      id: value.id, note_id: value.noteId, body: value.body, created_at: value.created_at,
    });
    if (error?.code === '23505') result.skipped++;
    else if (error) throw new Error(`Комментарий ${value.id}: ${error.message}`);
    else result.comments++;
    onProgress(`Комментарии: ${result.comments} / ${comments.length}`);
  }
  return result;
};
