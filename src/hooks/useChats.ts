import { useCallback, useMemo } from 'react';
import { type Chat, fetchChats } from '../lib/api';
import { applyToChats } from '../lib/offline/apply';
import type { OutboxItem } from '../lib/offline/outbox';
import { useCachedQuery } from './useCachedQuery';
import { useOutbox, useOutboxApplied } from './useOutbox';

const fetchRecentChats = () => fetchChats();

/** The user's saved chats, most recently active first; works offline like the inbox. */
export const useChats = (userId: string) => {
  const { data, error, loading, setData } = useCachedQuery<Chat[]>(
    `${userId}:chats`,
    fetchRecentChats,
  );
  const { items } = useOutbox();

  useOutboxApplied(
    useCallback(
      (item: OutboxItem) => setData((chats) => chats && applyToChats(chats, item)),
      [setData],
    ),
  );

  const chats = useMemo(() => {
    const base = data ?? (loading ? undefined : []);
    return base && items.reduce(applyToChats, base);
  }, [data, loading, items]);

  return { chats, error };
};
