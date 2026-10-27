import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { addInboxNote, inboxNoteReward } from '../lib/api';

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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const text = body.trim();
  const reward = inboxNoteReward(text);

  const save = async () => {
    if (!text || pending) return;
    setPending(true);
    setError(null);
    try {
      await addInboxNote(text);
      setBody('');
      onSaved(reward);
      onClose();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setPending(false);
    }
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
        {error && <p className="error">{error}</p>}
        <div className="sheet-actions">
          <span className="muted sheet-reward">+{reward} мон.</span>
          <button type="button" className="link" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={!text || pending}>
            {pending ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </dialog>
  );
};
