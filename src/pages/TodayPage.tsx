import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { BalanceCard } from '../components/BalanceCard';
import { Loader } from '../components/Loader';
import { QuestDialog } from '../components/QuestDialog';
import { QuestItem } from '../components/QuestItem';
import { StreakCard } from '../components/StreakCard';
import { useQuests } from '../hooks/useQuests';
import { useSyncedQuery } from '../hooks/useSyncedQuery';
import { useAppContext } from '../layouts/AppLayout';
import { type DayStart, type Quest, fetchDayStarts } from '../lib/api';
import { formatDay, formatTime } from '../lib/dates';
import { applyToDayStarts } from '../lib/offline/apply';
import { categoryLabels, occurrencesFor } from '../lib/quests';

const noStarts: DayStart[] = [];
/** Above this many planned quests a gentle hint suggests postponing some. */
const COMFORTABLE = 3;

export const TodayPage = () => {
  const { profile, dailyClaim, day } = useAppContext();
  const { quests, logs, error, add, update, remove, setStatus, postpone, reopen } = useQuests(
    profile.id,
  );
  const { data: starts } = useSyncedQuery(
    `${profile.id}:day-starts:${day}`,
    useCallback(() => fetchDayStarts(day, day), [day]),
    applyToDayStarts,
    noStarts,
  );
  const [dialog, setDialog] = useState<{ quest: Quest | null } | null>(null);

  const { todays, overdue } = useMemo(
    () => occurrencesFor(quests ?? [], logs, day),
    [quests, logs, day],
  );
  const someday = useMemo(() => (quests ?? []).filter((q) => !q.date), [quests]);

  if (!quests) return error ? <p className="error">{error}</p> : <Loader inline />;

  const planned = todays.filter((o) => !o.log || o.log.status === 'done').length;
  const done = todays.filter((o) => o.log?.status === 'done').length;
  const start = starts?.find((s) => s.day === day);

  return (
    <>
      <section className="card area-today">
        <div className="card-header">
          <div>
            <h2>Сегодня, {formatDay(day)}</h2>
            {start && (
              <p className="muted small">День начат в {formatTime(start.started_at)}</p>
            )}
          </div>
          <button type="button" className="btn btn-small" onClick={() => setDialog({ quest: null })}>
            + Квест
          </button>
        </div>

        {planned === 0 ? (
          <p className="hint">
            Выбери 1–3 посильных дела: создай квест или возьми из «Когда-нибудь». Можно и ничего
            не выбирать.
          </p>
        ) : planned > COMFORTABLE ? (
          <p className="hint">
            На сегодня {planned} дел. Обычно хватает 1–3 — любое можно отложить или отклонить без
            последствий.
          </p>
        ) : (
          done > 0 && done === planned && <p className="hint">Всё выбранное сделано.</p>
        )}

        {todays.length > 0 && (
          <ul className="quests">
            {todays.map((o) => (
              <QuestItem
                key={o.quest.id}
                occurrence={o}
                onStatus={(status) => (status ? setStatus(o.quest.id, o.day, status) : reopen(o))}
                onPostpone={() => postpone(o)}
                onOpen={(quest) => setDialog({ quest })}
              />
            ))}
          </ul>
        )}

        {overdue.length > 0 && (
          <>
            <h3 className="subheading">С прошлых дней</h3>
            <ul className="quests">
              {overdue.map((o) => (
                <QuestItem
                  key={o.quest.id}
                  occurrence={o}
                  showDay
                  onStatus={(status) => setStatus(o.quest.id, o.day, status)}
                  onPostpone={() => postpone(o)}
                  onToday={() => update(o.quest.id, { date: day })}
                  onOpen={(quest) => setDialog({ quest })}
                />
              ))}
            </ul>
          </>
        )}

        {someday.length > 0 && (
          <>
            <h3 className="subheading">Когда-нибудь</h3>
            <ul className="someday">
              {someday.map((q) => (
                <li key={q.id}>
                  <button type="button" className="quest-main" onClick={() => setDialog({ quest: q })}>
                    <span>{q.title}</span>
                    <span className="muted small">{categoryLabels[q.category]}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => update(q.id, { date: day })}
                  >
                    На сегодня
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      <BalanceCard className="area-balance" coins={profile.coins} dailyClaim={dailyClaim} />
      <StreakCard
        className="area-streak"
        current={profile.current_streak}
        longest={profile.longest_streak}
      />
      <Link to="/coins" className="link small coins-link">
        История монет →
      </Link>

      <QuestDialog
        open={dialog !== null}
        quest={dialog?.quest}
        defaultDate={day}
        onClose={() => setDialog(null)}
        onCreate={add}
        onUpdate={update}
        onDelete={remove}
      />
    </>
  );
};
