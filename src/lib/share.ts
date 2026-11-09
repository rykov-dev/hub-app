import type { EntryKind } from './api';

/** Written by public/sw.js when something is shared to the app; keep in sync. */
const SHARE_CACHE = 'share-target';

export type SharedItem = {
  text: string;
  kind: EntryKind;
  image: Blob | null;
};

const URL_ONLY = /^https?:\/\/\S+$/i;
export const isUrl = (text: string) => URL_ONLY.test(text.trim());

/** Title, text and URL as one entry text, without repeating parts. */
const compose = ({ title, text, url }: { title: string; text: string; url: string }) => {
  const parts: string[] = [];
  for (const part of [title, text, url].map((p) => p.trim())) {
    if (part && !parts.some((p) => p.includes(part))) parts.push(part);
  }
  return parts.join('\n');
};

let taking: Promise<SharedItem | null> | null = null;

/**
 * Takes the oldest share waiting in the service worker's cache, removing it.
 * Returns null when there is none (or the browser has no Cache API). Calls
 * made while one is running get its result, so a remount doesn't lose it.
 */
export const takeSharedItem = (): Promise<SharedItem | null> => {
  taking ??= take().finally(() => {
    taking = null;
  });
  return taking;
};

const take = async (): Promise<SharedItem | null> => {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(SHARE_CACHE);
    const metas = (await cache.keys()).filter((r) => r.url.endsWith('/meta'));
    const metaRequest = metas.sort((a, b) => a.url.localeCompare(b.url))[0];
    if (!metaRequest) return null;
    const base = metaRequest.url.slice(0, -'meta'.length);
    const meta = await (await cache.match(metaRequest))?.json();
    const image = (await (await cache.match(`${base}image`))?.blob()) ?? null;
    await cache.delete(metaRequest);
    await cache.delete(`${base}image`);

    const text = compose({ title: '', text: '', url: '', ...meta });
    const hasUrl = Boolean(meta?.url) || /https?:\/\//i.test(text);
    return { text, kind: hasUrl && !image ? 'link' : 'note', image };
  } catch {
    return null;
  }
};
