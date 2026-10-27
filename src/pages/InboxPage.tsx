import { InboxNoteList } from '../components/InboxNoteList';
import { Loader } from '../components/Loader';
import { useInboxNotes } from '../hooks/useInboxNotes';
import { useAppContext } from '../layouts/AppLayout';

export const InboxPage = () => {
  const { notesVersion } = useAppContext();
  const { notes, error } = useInboxNotes(notesVersion);

  if (error) return <p className="error">{error}</p>;
  if (!notes) return <Loader inline />;
  return <InboxNoteList className="area-inbox" notes={notes} />;
};
