import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  QUEST_CATEGORIES,
  QUEST_REPEATS,
  type Quest,
  type QuestCategory,
  type QuestPatch,
  type QuestRepeat,
} from '../lib/api';
import { addDays, today } from '../lib/dates';
import { categoryHints, categoryLabels, repeatLabels } from '../lib/quests';
import type { NewQuest } from '../hooks/useQuests';

type Props = {
  open: boolean;
  /** Edits this quest; without it, creates a new one. */
  quest?: Quest | null;
  /** Date for a new quest; null for "some day". */
  defaultDate?: string | null;
  onClose: () => void;
  onCreate: (quest: NewQuest) => void;
  onUpdate: (id: string, patch: QuestPatch) => void;
  onDelete: (id: string) => void;
};

/** Creates or edits a quest. Only the title is needed; the category can't change later. */
export const QuestDialog = ({
  open,
  quest,
  defaultDate = today(),
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: Props) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<QuestCategory>('maintenance');
  const [why, setWhy] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [repeat, setRepeat] = useState<QuestRepeat>('none');
  const [until, setUntil] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Fresh form every time it opens; a synced copy of the same quest doesn't reset it.
  const questId = quest?.id;
  useEffect(() => {
    if (!open) return;
    setTitle(quest?.title ?? '');
    setCategory(quest?.category ?? 'maintenance');
    setWhy(quest?.why ?? '');
    setDate(quest ? (quest.date ?? '') : (defaultDate ?? ''));
    setTime(quest?.time?.slice(0, 5) ?? '');
    setRepeat(quest?.repeat ?? 'none');
    setUntil(quest?.repeat_until ?? '');
    setConfirmingDelete(false);
  }, [open, questId, defaultDate]);

  const name = title.trim();
  const repeats = date !== '' && repeat !== 'none';
  const valid = name.length > 0 && (!repeats || until === '' || until >= date);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const fields: QuestPatch = {
      title: name,
      why: why.trim() || null,
      date: date || null,
      time: date && time ? time : null,
      repeat: date ? repeat : 'none',
      repeat_until: repeats && until ? until : null,
    };
    if (quest) onUpdate(quest.id, fields);
    else onCreate({ ...fields, title: name, category });
    onClose();
  };

  const onDeleteClick = () => {
    if (!quest) return;
    if (!confirmingDelete) return setConfirmingDelete(true);
    onDelete(quest.id);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="quest-dialog-title"
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
    >
      <form className="sheet-body" onSubmit={onSubmit}>
        <h2 id="quest-dialog-title">{quest ? 'Квест' : 'Новый квест'}</h2>
        <input
          className="input"
          placeholder="Что сделать?"
          aria-label="Название"
          maxLength={200}
          autoFocus={!quest}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        {quest ? (
          <p className="muted small">
            {categoryLabels[quest.category]} — {categoryHints[quest.category]}
          </p>
        ) : (
          <label className="field">
            <span className="muted small">Тип</span>
            <select
              className="input select"
              value={category}
              onChange={(e) => setCategory(e.target.value as QuestCategory)}
            >
              {QUEST_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabels[c]} — {categoryHints[c]}
                </option>
              ))}
            </select>
          </label>
        )}
        <textarea
          className="input textarea textarea-small"
          placeholder="Зачем? (необязательно)"
          aria-label="Зачем"
          maxLength={2000}
          rows={2}
          value={why}
          onChange={(e) => setWhy(e.target.value)}
        />
        <div className="field">
          <span className="muted small">Когда</span>
          <div className="chips">
            {[
              { label: 'Сегодня', value: today() },
              { label: 'Завтра', value: addDays(today(), 1) },
              { label: 'Когда-нибудь', value: '' },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                className={`chip ${date === option.value ? 'chip-active' : ''}`}
                onClick={() => setDate(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="field-row">
            <input
              type="date"
              className="input"
              aria-label="Дата"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <input
              type="time"
              className="input"
              aria-label="Время (пусто — весь день)"
              title="Пусто — весь день"
              disabled={!date}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>
        {date && (
          <div className="field-row">
            <select
              className="input select"
              aria-label="Повтор"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as QuestRepeat)}
            >
              {QUEST_REPEATS.map((r) => (
                <option key={r} value={r}>
                  {repeatLabels[r]}
                </option>
              ))}
            </select>
            {repeat !== 'none' && (
              <input
                type="date"
                className="input"
                aria-label="Повторять до (необязательно)"
                title="Повторять до (необязательно)"
                min={date}
                value={until}
                onChange={(e) => setUntil(e.target.value)}
              />
            )}
          </div>
        )}
        <div className="sheet-actions">
          {quest && (
            <button type="button" className="link link-danger sheet-actions-start" onClick={onDeleteClick}>
              {confirmingDelete ? 'Точно удалить с историей?' : 'Удалить'}
            </button>
          )}
          <button type="button" className="link" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={!valid}>
            Сохранить
          </button>
        </div>
      </form>
    </dialog>
  );
};
