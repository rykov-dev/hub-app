import { Link } from 'react-router';
import type { InboxNote } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { TagList } from './TagList';

type Props = {
  notes: InboxNote[];
  className?: string;
};

export const InboxNoteList = ({ notes, className = '' }: Props) => (
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
              <time className="muted small" dateTime={note.created_at}>
                {formatDateTime(note.created_at)}
              </time>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </section>
);
