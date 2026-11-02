import { type FormEvent, type KeyboardEvent, useState } from 'react';
import type { NoteComment } from '../lib/vault/model';
import { formatDateTime } from '../lib/format';

type Props = {
  comments: NoteComment[];
  /** Comments saved on this device but not yet on the server. */
  pendingIds: Set<string>;
  onAdd: (body: string) => void;
};

export const NoteComments = ({ comments, pendingIds, onAdd }: Props) => {
  const [body, setBody] = useState('');
  const text = body.trim();

  const submit = () => {
    if (!text) return;
    onAdd(text);
    setBody('');
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <section className="comments">
      <h2>Комментарии</h2>
      {comments.length > 0 && (
        <ul className="notes">
          {comments.map((c) => (
            <li key={c.id}>
              <p className="note-body">{c.body}</p>
              <span className="muted small">
                <time dateTime={c.created_at}>{formatDateTime(c.created_at)}</time>
                {pendingIds.has(c.id) && ' · ждёт синхронизации'}
              </span>
            </li>
          ))}
        </ul>
      )}
      <form className="comment-form" onSubmit={onSubmit}>
        <textarea
          className="input textarea textarea-small"
          placeholder="Добавить комментарий"
          aria-label="Комментарий"
          rows={3}
          maxLength={5000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="sheet-actions">
          <button type="submit" className="btn btn-primary" disabled={!text}>
            Комментировать
          </button>
        </div>
      </form>
    </section>
  );
};
