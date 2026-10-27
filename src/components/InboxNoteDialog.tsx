import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { inboxNoteReward } from '../lib/api';
import { outbox } from '../lib/offline/outbox';

const MAX_LENGTH = 10_000;

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called with the coins the note earned. */
  onSaved: (reward: number) => void;
};

/**
 * Form for adding a note to the inbox, shown in a native modal dialog:
 * a bottom sheet on phones, a centered window on larger screens.
 * The draft survives closing the dialog without saving.
 */
export const InboxNoteDialog = ({ open, onClose, onSaved }: Props) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [body, setBody] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const text = body.trim();
  const reward = inboxNoteReward(text);

  // Saved locally right away and synced in the background, so it works offline.
  const save = () => {
    if (!text) return;
    outbox.enqueue({
      kind: 'addNote',
      note: { id: crypto.randomUUID(), body: text, tags: [], created_at: new Date().toISOString() },
    });
    setBody('');
    onSaved(reward);
    onClose();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="inbox-note-title"
      onClose={onClose}
      // A click on the dialog element itself (not its content) is a click on the backdrop.
      onClick={(e) => e.target === dialogRef.current && onClose()}
    >
      <form className="sheet-body" onSubmit={onSubmit}>
        <h2 id="inbox-note-title">Новая заметка в Inbox</h2>
        <textarea
          className="input textarea"
          placeholder="Что пришло в голову?"
          rows={6}
          maxLength={MAX_LENGTH}
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="sheet-actions">
          <span className="muted sheet-reward">+{reward} мон.</span>
          <button type="button" className="link" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={!text}>
            Сохранить
          </button>
        </div>
      </form>
    </dialog>
  );
};
