import { useCallback, useEffect, useState } from 'react';
import {
  type InboxNote,
  type NoteComment,
  addNoteComment,
  fetchInboxNote,
  fetchNoteComments,
  updateNoteTags,
} from '../lib/api';

/** A single inbox note with its comments, plus actions on them. */
export const useInboxNote = (id: string) => {
  // undefined while loading, null when the note doesn't exist.
  const [note, setNote] = useState<InboxNote | null | undefined>(undefined);
  const [comments, setComments] = useState<NoteComment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNote(undefined);
    Promise.all([fetchInboxNote(id), fetchNoteComments(id)])
      .then(([n, c]) => {
        if (cancelled) return;
        setNote(n);
        setComments(c);
      })
      .catch((e) => !cancelled && setError(String(e.message ?? e)));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const setTags = useCallback(
    async (tags: string[]) => {
      // Optimistic: show the change right away, roll back if saving fails.
      const previous = note?.tags ?? [];
      setNote((n) => n && { ...n, tags });
      try {
        await updateNoteTags(id, tags);
        setError(null);
      } catch (e) {
        setNote((n) => n && { ...n, tags: previous });
        setError(String((e as Error).message ?? e));
      }
    },
    [id, note?.tags],
  );

  const addComment = useCallback(
    async (body: string) => {
      const comment = await addNoteComment(id, body);
      setComments((c) => [...c, comment]);
    },
    [id],
  );

  return { note, comments, error, setTags, addComment };
};
