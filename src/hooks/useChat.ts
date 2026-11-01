import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SavedChatMessage } from '../lib/api';
import { streamChat } from '../lib/chat/client';
import { outbox } from '../lib/offline/outbox';
import { useChatMessages } from './useChatMessages';

export type ChatStatus = 'idle' | 'waiting' | 'thinking' | 'answering';

const TITLE_LENGTH = 60;

/** A new chat is named after the start of its first message. */
const chatTitle = (text: string) => {
  const line = text.split('\n')[0].trim();
  return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1)}…` : line;
};

const message = (role: SavedChatMessage['role'], content: string): SavedChatMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  created_at: new Date().toISOString(),
});

/** The question being answered, shown until both it and the answer are saved. */
type Turn = {
  /** The chat it is shown in: undefined for a new chat until the model replies. */
  chatId: string | undefined;
  question: SavedChatMessage;
  answer: string;
};

/**
 * A saved conversation with the chat model. Messages are saved through the
 * outbox once the model starts replying, so a model that fails leaves nothing
 * behind; the answer is saved when it's finished or stopped.
 * `chatId` is undefined for a new chat; the first reply creates it.
 */
export const useChat = (
  userId: string,
  chatId: string | undefined,
  handlers: { onCreated: (id: string) => void; onModelError: () => void },
) => {
  const { messages: history, error: loadError } = useChatMessages(userId, chatId);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const turnChatRef = useRef<string | undefined>(undefined);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => () => abortRef.current?.abort(), []);

  // Leaving for another chat stops the answer; what was written is still saved.
  useEffect(() => {
    if (abortRef.current && turnChatRef.current !== chatId) abortRef.current.abort();
    setError(null);
  }, [chatId]);

  /** Resolves to false when nothing was saved, so the text can go back to the input. */
  const send = useCallback(
    async (text: string): Promise<boolean> => {
      const id = chatId ?? crypto.randomUUID();
      const question = message('user', text);
      const controller = new AbortController();
      abortRef.current = controller;
      turnChatRef.current = chatId;
      setTurn({ chatId, question, answer: '' });
      setError(null);
      setStatus('waiting');

      let saved = false;
      const save = () => {
        if (saved) return;
        saved = true;
        if (!chatId) {
          outbox.enqueue({
            kind: 'addChat',
            chat: {
              id,
              title: chatTitle(text),
              created_at: question.created_at,
              updated_at: question.created_at,
            },
          });
        }
        outbox.enqueue({ kind: 'addChatMessage', chatId: id, message: question });
        if (!chatId) {
          turnChatRef.current = id;
          setTurn((t) => t && { ...t, chatId: id });
          handlersRef.current.onCreated(id);
        }
      };

      let content = '';
      try {
        await streamChat(
          [...history, question].map(({ role, content }) => ({ role, content })),
          {
            onText: (piece) => {
              save();
              content += piece;
              setStatus('answering');
              setTurn((t) => t && { ...t, answer: content });
            },
            onThinking: () => {
              save();
              setStatus('thinking');
            },
          },
          controller.signal,
        );
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : String(err));
          if (!saved) handlersRef.current.onModelError();
        }
      } finally {
        if (content.trim()) {
          outbox.enqueue({ kind: 'addChatMessage', chatId: id, message: message('assistant', content) });
        }
        abortRef.current = null;
        setTurn(null);
        setStatus('idle');
      }
      return saved;
    },
    [chatId, history],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const messages = useMemo(() => {
    if (!turn || turn.chatId !== chatId) return history;
    const shown = history.some((m) => m.id === turn.question.id)
      ? history
      : [...history, turn.question];
    return [
      ...shown,
      { id: 'answer', role: 'assistant' as const, content: turn.answer, created_at: '' },
    ];
  }, [history, turn, chatId]);

  return { messages, status, error: error ?? loadError, send, stop };
};
