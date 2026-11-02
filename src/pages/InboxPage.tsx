import { InboxNoteList } from '../components/InboxNoteList';
import { useNotes } from '../hooks/useNotes';

export const InboxPage = () => {
  const { notes, pendingIds } = useNotes();
  return <InboxNoteList className="area-inbox" notes={notes} pendingIds={pendingIds} />;
};
