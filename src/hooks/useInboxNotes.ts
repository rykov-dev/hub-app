import { useCallback, useMemo } from 'react';
import { type InboxNote, fetchInboxNotes } from '../lib/api';
import { applyToNotes } from '../lib/offline/apply';
import type { OutboxItem } from '../lib/offline/outbox';
import { useCachedQuery } from './useCachedQuery';
import { useOutbox, useOutboxApplied } from './useOutbox';

const fetchRecentNotes = () => fetchInboxNotes();

/**
 * The user's inbox notes, newest first: saved ones from the server or the
 * offline cache, with changes still waiting to sync applied on top.
 */
export const useInboxNotes = (userId: string) => {
  const { data, error, loading, setData } = useCachedQuery<InboxNote[]>(
    `${userId}:notes`,
    fetchRecentNotes,
  );
  const { items } = useOutbox();

  useOutboxApplied(
    useCallback(
      (item: OutboxItem) => setData((notes) => notes && applyToNotes(notes, item)),
      [setData],
    ),
  );

  const notes = useMemo(() => {
    // Offline with nothing cached, only this device's pending notes are known.
    const base = data ?? (loading ? undefined : []);
    return base && items.reduce(applyToNotes, base);
  }, [data, loading, items]);

  const pendingIds = useMemo(
    () => new Set(items.flatMap((i) => (i.kind === 'addNote' ? [i.note.id] : []))),
    [items],
  );

  return { notes, pendingIds, error };
};
