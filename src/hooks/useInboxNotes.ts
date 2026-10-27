import { useEffect, useState } from 'react';
import { type InboxNote, fetchInboxNotes } from '../lib/api';

/** The user's inbox notes, newest first; reloads whenever `version` changes. */
export const useInboxNotes = (version: number) => {
  const [notes, setNotes] = useState<InboxNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchInboxNotes()
      .then((data) => !cancelled && setNotes(data))
      .catch((e) => !cancelled && setError(String(e.message ?? e)));
    return () => {
      cancelled = true;
    };
  }, [version]);

  return { notes, error };
};
