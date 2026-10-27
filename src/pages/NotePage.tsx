import { Link, useParams } from 'react-router';
import { Loader } from '../components/Loader';
import { NoteComments } from '../components/NoteComments';
import { TagEditor } from '../components/TagEditor';
import { useInboxNote } from '../hooks/useInboxNote';
import { formatDateTime } from '../lib/format';

export const NotePage = () => {
  const { noteId = '' } = useParams();
  const { note, comments, error, setTags, addComment } = useInboxNote(noteId);

  if (note === undefined) return error ? <p className="error">{error}</p> : <Loader inline />;

  return (
    <article className="card area-inbox">
      <Link to="/inbox" className="link back-link">
        ← Inbox
      </Link>
      {note === null ? (
        <p className="muted">Заметка не найдена.</p>
      ) : (
        <>
          <p className="note-body note-body-large">{note.body}</p>
          <time className="muted small" dateTime={note.created_at}>
            {formatDateTime(note.created_at)}
          </time>
          <TagEditor tags={note.tags} onChange={setTags} />
          {error && <p className="error">{error}</p>}
          <NoteComments comments={comments} onAdd={addComment} />
        </>
      )}
    </article>
  );
};
