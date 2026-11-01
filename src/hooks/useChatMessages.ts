import { useCallback, useMemo } from 'react';
import { type SavedChatMessage, fetchChatMessages } from '../lib/api';
import { applyToChatMessages } from '../lib/offline/apply';
import type { OutboxItem } from '../lib/offline/outbox';
import { useCachedQuery } from './useCachedQuery';
import { useOutbox, useOutboxApplied } from './useOutbox';

const noMessages = async (): Promise<SavedChatMessage[]> => [];

/** Saved messages of a chat, with ones still waiting to sync; empty for a new chat. */
export const useChatMessages = (userId: string, chatId: string | undefined) => {
  const { data, error, setData } = useCachedQuery<SavedChatMessage[]>(
    `${userId}:chat:${chatId ?? 'new'}`,
    useCallback(() => (chatId ? fetchChatMessages(chatId) : noMessages()), [chatId]),
  );
  const { items } = useOutbox();

  useOutboxApplied(
    useCallback(
      (item: OutboxItem) => {
        if (chatId) setData((m) => m && applyToChatMessages(m, chatId, item));
      },
      [chatId, setData],
    ),
  );

  const messages = useMemo(
    () =>
      chatId
        ? items.reduce((m, item) => applyToChatMessages(m, chatId, item), data ?? [])
        : [],
    [data, items, chatId],
  );

  return { messages, error };
};
