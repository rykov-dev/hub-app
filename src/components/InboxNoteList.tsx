import { Link } from 'react-router';
import type { InboxNote } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { entryKindLabels } from '../lib/quests';
import { NoteImage } from './NoteImage';
import { TagList } from './TagList';

type Props = {
  userId: string;
  notes: InboxNote[];
  /** Entries saved on this device but not yet on the server. */
  pendingIds: Set<string>;
  className?: string;
};

export const InboxNoteList = ({ userId, notes, pendingIds, className = '' }: Props) => (
  <section className={`card ${className}`}>
    <h2>Inbox</h2>
    {notes.length === 0 ? (
      <p className="muted">Пока пусто. Нажми «Inbox», чтобы записать мысль.</p>
    ) : (
      <ul className="notes">
        {notes.map((note) => (
          <li key={note.id}>
            <Link to={`/inbox/${note.id}`} className="note-link">
              <div className="note-row">
                <div className="note-row-text">
                  {note.body ? (
                    <p className="note-body note-preview">{note.body}</p>
                  ) : (
                    <p className="muted">Изображение</p>
                  )}
                  <TagList tags={note.tags} />
                </div>
                <NoteImage userId={userId} path={note.image_path} thumbnail />
              </div>
              <span className="muted small">
                {note.kind !== 'note' && (
                  <span className="kind-label">{entryKindLabels[note.kind]} · </span>
                )}
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
