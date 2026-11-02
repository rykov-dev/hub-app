import { supabase } from '../supabase';
import { COMMENTS_DIR, NOTES_DIR } from './model';

// Encrypted objects in Storage, under a folder named after the user's id
// (Storage policies allow nothing else). Paths here are relative to it.
const bucket = () => supabase.storage.from('vault');

const PAGE = 1000;

export type RemoteObject = { path: string; updatedAt: string };

const listDir = async (userId: string, dir: string): Promise<RemoteObject[]> => {
  const objects: RemoteObject[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await bucket().list(`${userId}/${dir}`, {
      limit: PAGE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    for (const o of data) {
      if (!o.name.endsWith('.bin')) continue;
      objects.push({ path: `${dir}/${o.name}`, updatedAt: o.updated_at ?? o.created_at ?? '' });
    }
    if (data.length < PAGE) return objects;
  }
};

export const listRemote = async (userId: string) =>
  (await Promise.all([listDir(userId, NOTES_DIR), listDir(userId, COMMENTS_DIR)])).flat();

export const downloadObject = async (userId: string, path: string): Promise<Uint8Array> => {
  const { data, error } = await bucket().download(`${userId}/${path}`);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
};

export const uploadObject = async (userId: string, path: string, data: Uint8Array) => {
  const { error } = await bucket().upload(`${userId}/${path}`, data, {
    upsert: true,
    contentType: 'application/octet-stream',
  });
  if (error) throw error;
};

/** Removing objects that are already gone is not an error. */
export const removeObjects = async (userId: string, paths: string[]) => {
  const { error } = await bucket().remove(paths.map((p) => `${userId}/${p}`));
  if (error) throw error;
};
