import { type FormEvent, useState } from 'react';
import type { InboxNote, NotePatch } from '../lib/api';
import { fromLocalInput, toLocalInput } from '../lib/dates';

type Props = {
  note: InboxNote;
  onSave: (patch: NotePatch) => void;
  onCancel: () => void;
};

/** Edits an entry's text and date/time; its kind and image stay as they are. */
export const NoteEditForm = ({ note, onSave, onCancel }: Props) => {
  const [body, setBody] = useState(note.body);
  const [when, setWhen] = useState(toLocalInput(note.created_at));
  const text = body.trim();
  const valid = (text.length > 0 || note.image_path !== null) && when !== '';

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const patch: NotePatch = {};
    if (text !== note.body) patch.body = text;
    if (when !== toLocalInput(note.created_at)) patch.created_at = fromLocalInput(when);
    if (Object.keys(patch).length > 0) onSave(patch);
    onCancel();
  };

  return (
    <form className="comment-form" onSubmit={onSubmit}>
      <textarea
        className="input textarea"
        aria-label="Текст записи"
        maxLength={10_000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <label className="field">
        <span className="muted small">Дата и время</span>
        <input
          type="datetime-local"
          className="input"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
      </label>
      <div className="sheet-actions">
        <button type="button" className="link" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className="btn btn-primary" disabled={!valid}>
          Сохранить
        </button>
      </div>
    </form>
  );
};
