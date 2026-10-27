import { useCallback, useMemo } from 'react';
import { type InboxNote, type NoteComment, fetchInboxNote, fetchNoteComments } from '../lib/api';
import { applyToComments, applyToNote } from '../lib/offline/apply';
import { type OutboxItem, outbox } from '../lib/offline/outbox';
import { readStored } from '../lib/offline/storage';
import { useCachedQuery } from './useCachedQuery';
import { useOutbox, useOutboxApplied } from './useOutbox';

/** A single inbox note with its comments, plus actions on them; works offline. */
export const useInboxNote = (userId: string, id: string) => {
  const noteQuery = useCachedQuery<InboxNote | null>(
    `${userId}:note:${id}`,
    useCallback(() => fetchInboxNote(id), [id]),
    {
      // Not opened before: the cached list may still have it.
      fallback: async () =>
        (await readStored<InboxNote[]>(`${userId}:notes`))?.find((n) => n.id === id),
    },
  );
  const commentsQuery = useCachedQuery<NoteComment[]>(
    `${userId}:comments:${id}`,
    useCallback(() => fetchNoteComments(id), [id]),
  );
  const { items } = useOutbox();

  const setNoteData = noteQuery.setData;
  const setCommentsData = commentsQuery.setData;
  useOutboxApplied(
    useCallback(
      (item: OutboxItem) => {
        setNoteData((n) => (n === undefined ? n : applyToNote(n, id, item)));
        setCommentsData((c) => c && applyToComments(c, id, item));
      },
      [id, setNoteData, setCommentsData],
    ),
  );

  // undefined while loading, null when the note doesn't exist.
  const note = useMemo(() => {
    if (noteQuery.data === undefined && noteQuery.loading) return undefined;
    return items.reduce((n, item) => applyToNote(n, id, item), noteQuery.data ?? null);
  }, [noteQuery.data, noteQuery.loading, items, id]);

  const comments = useMemo(
    () => items.reduce((c, item) => applyToComments(c, id, item), commentsQuery.data ?? []),
    [commentsQuery.data, items, id],
  );

  const pendingCommentIds = useMemo(
    () =>
      new Set(
        items.flatMap((i) => (i.kind === 'addComment' && i.noteId === id ? [i.comment.id] : [])),
      ),
    [items, id],
  );

  const setTags = useCallback(
    (tags: string[]) => outbox.enqueue({ kind: 'setTags', noteId: id, tags }),
    [id],
  );

  const addComment = useCallback(
    (body: string) =>
      outbox.enqueue({
        kind: 'addComment',
        noteId: id,
        comment: { id: crypto.randomUUID(), body, created_at: new Date().toISOString() },
      }),
    [id],
  );

  return {
    note,
    comments,
    pendingCommentIds,
    error: noteQuery.error ?? commentsQuery.error,
    setTags,
    addComment,
  };
};
