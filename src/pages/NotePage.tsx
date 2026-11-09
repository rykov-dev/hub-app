import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { LinkifiedText } from '../components/LinkifiedText';
import { Loader } from '../components/Loader';
import { NoteComments } from '../components/NoteComments';
import { NoteEditForm } from '../components/NoteEditForm';
import { NoteImage } from '../components/NoteImage';
import { TagEditor } from '../components/TagEditor';
import { useInboxNote } from '../hooks/useInboxNote';
import { useAppContext } from '../layouts/AppLayout';
import { formatDateTime } from '../lib/format';
import { entryKindLabels } from '../lib/quests';

export const NotePage = () => {
  const { noteId = '' } = useParams();
  const { profile } = useAppContext();
  const navigate = useNavigate();
  const { note, comments, pendingCommentIds, error, setTags, update, addComment, remove } =
    useInboxNote(profile.id, noteId);
  // Deleting takes a second click, so a slip doesn't lose an entry.
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);

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
        <p className="muted">Запись не найдена.</p>
      ) : (
        <>
          <span className="kind-badge">{entryKindLabels[note.kind]}</span>
          {editing ? (
            <NoteEditForm note={note} onSave={update} onCancel={() => setEditing(false)} />
          ) : (
            <>
              {note.body && <LinkifiedText className="note-body note-body-large" text={note.body} />}
              <div className="note-meta">
                <time className="muted small" dateTime={note.created_at}>
                  {formatDateTime(note.created_at)}
                </time>
                <button type="button" className="link small" onClick={() => setEditing(true)}>
                  Изменить
                </button>
              </div>
            </>
          )}
          <NoteImage userId={profile.id} path={note.image_path} />
          <TagEditor tags={note.tags} onChange={setTags} />
          {error && <p className="error">{error}</p>}
          <NoteComments comments={comments} pendingIds={pendingCommentIds} onAdd={addComment} />
          <div className="note-actions">
            <button type="button" className="btn btn-danger" onClick={onDelete}>
              {confirming ? 'Точно удалить вместе с комментариями?' : 'Удалить запись'}
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
