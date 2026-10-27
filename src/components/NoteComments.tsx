import { type FormEvent, type KeyboardEvent, useState } from 'react';
import type { NoteComment } from '../lib/api';
import { formatDateTime } from '../lib/format';

type Props = {
  comments: NoteComment[];
  onAdd: (body: string) => Promise<void>;
};

export const NoteComments = ({ comments, onAdd }: Props) => {
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = body.trim();

  const submit = async () => {
    if (!text || pending) return;
    setPending(true);
    setError(null);
    try {
      await onAdd(text);
      setBody('');
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setPending(false);
    }
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
              <time className="muted small" dateTime={c.created_at}>
                {formatDateTime(c.created_at)}
              </time>
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
        {error && <p className="error">{error}</p>}
        <div className="sheet-actions">
          <button type="submit" className="btn btn-primary" disabled={!text || pending}>
            {pending ? 'Сохраняем…' : 'Комментировать'}
          </button>
        </div>
      </form>
    </section>
  );
};
