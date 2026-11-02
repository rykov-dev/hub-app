import { Link } from 'react-router';
import type { Note } from '../lib/vault/model';
import { formatDateTime } from '../lib/format';
import { TagList } from './TagList';

type Props = {
  notes: Note[];
  /** Notes saved on this device but not yet on the server. */
  pendingIds: Set<string>;
  className?: string;
};

export const InboxNoteList = ({ notes, pendingIds, className = '' }: Props) => (
  <section className={`card ${className}`}>
    <h2>Inbox</h2>
    {notes.length === 0 ? (
      <p className="muted">Пока пусто. Нажми «Inbox», чтобы записать мысль.</p>
    ) : (
      <ul className="notes">
        {notes.map((note) => (
          <li key={note.id}>
            <Link to={`/inbox/${note.id}`} className="note-link">
              <p className="note-body note-preview">{note.body}</p>
              <TagList tags={note.tags} />
              <span className="muted small">
                <time dateTime={note.created_at}>{formatDateTime(note.created_at)}</time>
                {pendingIds.has(note.id) && ' · ждёт синхронизации'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </section>
);
