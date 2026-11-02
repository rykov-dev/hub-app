import { useMemo } from 'react';
import { pendingPaths } from '../lib/offline/outbox';
import { commentPath, notePath } from '../lib/vault/model';
import { vault } from '../lib/vault/vault';
import { useOutbox } from './useOutbox';
import { useVault } from './useVault';

/** Inbox notes, newest first, and which of them haven't reached the server yet. */
export const useNotes = () => {
  const { notes } = useVault();
  const { items } = useOutbox();
  const pendingIds = useMemo(() => {
    const pending = pendingPaths(items);
    return new Set(notes.filter((n) => pending.has(notePath(n.id))).map((n) => n.id));
  }, [notes, items]);
  return { notes, pendingIds };
};

/** One note with its comments and the actions on it; null when there's no such note. */
export const useNote = (id: string) => {
  const { notes, comments } = useVault();
  const { items } = useOutbox();
  const note = notes.find((n) => n.id === id) ?? null;
  const noteComments = comments.get(id) ?? [];
  const pendingCommentIds = useMemo(() => {
    const pending = pendingPaths(items);
    return new Set(noteComments.filter((c) => pending.has(commentPath(id, c.id))).map((c) => c.id));
  }, [noteComments, items, id]);

  return {
    note,
    comments: noteComments,
    pendingCommentIds,
    setTags: (tags: string[]) => vault.setTags(id, tags),
    addComment: (body: string) => vault.addComment(id, body),
    remove: () => vault.deleteNote(id),
  };
};
