import { Link } from 'react-router';
import { InboxNoteList } from '../components/InboxNoteList';
import { Loader } from '../components/Loader';
import { useInboxNotes } from '../hooks/useInboxNotes';
import { useAppContext } from '../layouts/AppLayout';

export const InboxPage = () => {
  const { profile } = useAppContext();
  const { notes, pendingIds, error } = useInboxNotes(profile.id);

  if (!notes) return error ? <p className="error">{error}</p> : <Loader inline />;
  return (
    <>
      {error && <p className="error">{error}</p>}
      <InboxNoteList className="area-inbox" notes={notes} pendingIds={pendingIds} />
      <p className="muted small"><Link to="/settings/import-vault">Перенести заметки из старого Deity Vault</Link></p>
    </>
  );
};
