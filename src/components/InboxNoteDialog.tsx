import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ENTRY_KINDS, type EntryKind, imagePathFor } from '../lib/api';
import { prepareImage } from '../lib/images';
import { outbox } from '../lib/offline/outbox';
import { entryKindLabels } from '../lib/quests';
import { type SharedItem, isUrl } from '../lib/share';

const MAX_LENGTH = 10_000;

type Props = {
  userId: string;
  open: boolean;
  /** Something shared to the app: fills the form when it arrives. */
  shared: SharedItem | null;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * Form for adding an entry to the inbox, shown in a native modal dialog:
 * a bottom sheet on phones, a centered window on larger screens.
 * Only the text (or an image) is needed; the kind defaults to a note.
 * The draft survives closing the dialog without saving.
 */
export const InboxNoteDialog = ({ userId, open, shared, onClose, onSaved }: Props) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<EntryKind>('note');
  // Once the user picks a kind, a pasted link no longer changes it.
  const [kindChosen, setKindChosen] = useState(false);
  const [image, setImage] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!image) return setPreview(null);
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const attach = async (file: Blob) => {
    setError(null);
    setProcessing(true);
    try {
      setImage(await prepareImage(file));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    if (!shared) return;
    setBody(shared.text);
    setKind(shared.kind);
    setKindChosen(false);
    setImage(null);
    setError(null);
    if (shared.image) attach(shared.image);
  }, [shared]);

  const text = body.trim();
  const canSave = (text.length > 0 || image !== null) && !processing;

  const onBodyChange = (value: string) => {
    setBody(value);
    if (!kindChosen) setKind(isUrl(value) ? 'link' : 'note');
  };

  const reset = () => {
    setBody('');
    setKind('note');
    setKindChosen(false);
    setImage(null);
    setError(null);
  };

  // Saved locally right away and synced in the background, so it works offline.
  const save = async () => {
    if (!canSave) return;
    const id = crypto.randomUUID();
    const note = {
      id,
      body: text,
      tags: [],
      kind,
      image_path: image ? imagePathFor(userId, id) : null,
      created_at: new Date().toISOString(),
    };
    if (image) await outbox.addNoteWithImage(note, image);
    else outbox.enqueue({ kind: 'addNote', note });
    reset();
    onSaved();
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
        <div className="sheet-header">
          <h2 id="inbox-note-title">Новая запись</h2>
          <select
            className="input select"
            aria-label="Тип записи"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as EntryKind);
              setKindChosen(true);
            }}
          >
            {ENTRY_KINDS.map((k) => (
              <option key={k} value={k}>
                {entryKindLabels[k]}
              </option>
            ))}
          </select>
        </div>
        <textarea
          className="input textarea"
          placeholder="Что происходит? Можно вставить ссылку."
          aria-label="Текст записи"
          rows={6}
          maxLength={MAX_LENGTH}
          autoFocus
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {preview && (
          <div className="attachment">
            <img src={preview} alt="Выбранное изображение" className="note-image-thumb" />
            <button type="button" className="link" onClick={() => setImage(null)}>
              Убрать изображение
            </button>
          </div>
        )}
        {error && <p className="error">{error}</p>}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) attach(file);
          }}
        />
        <div className="sheet-actions">
          <button
            type="button"
            className="link sheet-actions-start"
            disabled={processing}
            onClick={() => fileRef.current?.click()}
          >
            {processing ? 'Обработка…' : image ? 'Другое изображение' : '+ Изображение'}
          </button>
          <button type="button" className="link" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={!canSave}>
            Сохранить
          </button>
        </div>
      </form>
    </dialog>
  );
};
