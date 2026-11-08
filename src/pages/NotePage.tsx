import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Loader } from '../components/Loader';
import { NoteComments } from '../components/NoteComments';
import { TagEditor } from '../components/TagEditor';
import { useInboxNote } from '../hooks/useInboxNote';
import { useAppContext } from '../layouts/AppLayout';
import { formatDateTime } from '../lib/format';

export const NotePage = () => {
  const { noteId = '' } = useParams();
  const { profile } = useAppContext();
  const navigate = useNavigate();
  const { note, comments, pendingCommentIds, error, setTags, addComment, remove } = useInboxNote(
    profile.id,
    noteId,
  );
  // Deleting takes a second click, so a slip doesn't lose a note.
  const [confirming, setConfirming] = useState(false);

  const onDelete = () => {
    if (!confirming) return setConfirming(true);
    remove();
    navigate('/inbox', { replace: true });
  };

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
          <NoteComments comments={comments} pendingIds={pendingCommentIds} onAdd={addComment} />
          <div className="note-actions">
            <button type="button" className="btn btn-danger" onClick={onDelete}>
              {confirming ? 'Точно удалить вместе с комментариями?' : 'Удалить заметку'}
            </button>
            {confirming && (
              <button type="button" className="link" onClick={() => setConfirming(false)}>
                Отмена
              </button>
            )}
          </div>
        </>
      )}
    </article>
  );
};
