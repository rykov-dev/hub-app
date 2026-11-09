import { useMemo } from 'react';
import { type InboxNote, fetchInboxNotes } from '../lib/api';
import { applyToNotes } from '../lib/offline/apply';
import { useOutbox } from './useOutbox';
import { useSyncedQuery } from './useSyncedQuery';

const fetchRecentNotes = () => fetchInboxNotes();
const none: InboxNote[] = [];

/**
 * The user's inbox entries, newest first: saved ones from the server or the
 * offline cache, with changes still waiting to sync applied on top.
 */
export const useInboxNotes = (userId: string) => {
  const { data: notes, error } = useSyncedQuery(
    `${userId}:notes`,
    fetchRecentNotes,
    applyToNotes,
    none,
  );
  const { items } = useOutbox();

  const pendingIds = useMemo(
    () => new Set(items.flatMap((i) => (i.kind === 'addNote' ? [i.note.id] : []))),
    [items],
  );

  return { notes, pendingIds, error };
};
