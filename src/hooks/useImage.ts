import { useEffect, useState } from 'react';
import { downloadImage } from '../lib/api';
import { imageCacheKey } from '../lib/offline/outbox';
import { readStored, writeStored } from '../lib/offline/storage';

export type ImageState = { url: string } | { error: true } | undefined;

/**
 * An entry's image as an object URL: from this device if it was added or seen
 * here before, otherwise downloaded and kept for offline use.
 */
export const useImage = (userId: string, path: string | null): ImageState => {
  const [state, setState] = useState<ImageState>(undefined);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    let url: string | undefined;
    setState(undefined);
    (async () => {
      const key = imageCacheKey(userId, path);
      let image = await readStored<Blob>(key);
      if (!image) {
        try {
          image = await downloadImage(path);
          writeStored(key, image);
        } catch {
          if (!cancelled) setState({ error: true });
          return;
        }
      }
      if (cancelled) return;
      url = URL.createObjectURL(image);
      setState({ url });
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [userId, path]);

  return path ? state : undefined;
};
