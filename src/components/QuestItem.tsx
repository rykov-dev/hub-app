import type { Quest, QuestStatus } from '../lib/api';
import { formatDay, shortTime } from '../lib/dates';
import { type Occurrence, categoryLabels, statusLabels } from '../lib/quests';

type Props = {
  occurrence: Occurrence;
  /** Shown for quests left from earlier days. */
  showDay?: boolean;
  onStatus: (status: QuestStatus | null) => void;
  onPostpone: () => void;
  /** Moves a quest from an earlier day to today. */
  onToday?: () => void;
  onOpen: (quest: Quest) => void;
};

/** A quest on a day: what it is, why, and what to do with it. */
export const QuestItem = ({ occurrence, showDay, onStatus, onPostpone, onToday, onOpen }: Props) => {
  const { quest, day, log } = occurrence;
  return (
    <li className={`quest ${log ? `quest-${log.status}` : ''}`}>
      <button type="button" className="quest-main" onClick={() => onOpen(quest)}>
        <span className="quest-title">{quest.title}</span>
        <span className="muted small">
          {categoryLabels[quest.category]}
          {showDay && ` · ${formatDay(day)}`}
          {quest.time && ` · ${shortTime(quest.time)}`}
          {quest.repeat !== 'none' && ' · повторяется'}
        </span>
        {quest.why && <span className="muted small quest-why">Зачем: {quest.why}</span>}
      </button>
      {log ? (
        <div className="quest-actions">
          <span className="muted small">
            {statusLabels[log.status]}
            {log.status === 'postponed' && quest.repeat === 'none' && quest.date && quest.date !== day
              ? ` на ${formatDay(quest.date)}`
              : ''}
          </span>
          <button type="button" className="link small" onClick={() => onStatus(null)}>
            Вернуть
          </button>
        </div>
      ) : (
        <div className="quest-actions">
          <button type="button" className="btn btn-small btn-primary" onClick={() => onStatus('done')}>
            Сделано
          </button>
          {onToday ? (
            <button type="button" className="btn btn-small" onClick={onToday}>
              На сегодня
            </button>
          ) : (
            <button type="button" className="btn btn-small" onClick={onPostpone}>
              Отложить
            </button>
          )}
          <button type="button" className="link small" onClick={() => onStatus('declined')}>
            Отклонить
          </button>
        </div>
      )}
    </li>
  );
};
