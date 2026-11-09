import { useMemo, useState } from 'react';
import { Loader } from '../components/Loader';
import { QuestDialog } from '../components/QuestDialog';
import { useQuests } from '../hooks/useQuests';
import { useAppContext } from '../layouts/AppLayout';
import type { Quest } from '../lib/api';
import { categoryLabels, describeSchedule, logKey, statusLabels } from '../lib/quests';

/** Every quest, grouped by how it is planned; tap one to edit it. */
export const QuestsPage = () => {
  const { profile, day } = useAppContext();
  const { quests, logs, error, add, update, remove } = useQuests(profile.id, day);
  const [dialog, setDialog] = useState<{ quest: Quest | null } | null>(null);

  const groups = useMemo(() => {
    const repeating: Quest[] = [];
    const planned: Quest[] = [];
    const someday: Quest[] = [];
    const finished: Quest[] = [];
    for (const q of quests ?? []) {
      if (!q.date) someday.push(q);
      else if (q.repeat !== 'none') {
        if (q.repeat_until && q.repeat_until < day) finished.push(q);
        else repeating.push(q);
      } else if (logs.get(logKey(q.id, q.date))?.status === 'done' || logs.get(logKey(q.id, q.date))?.status === 'declined') {
        finished.push(q);
      } else planned.push(q);
    }
    const byDate = (a: Quest, b: Quest) =>
      (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '').localeCompare(b.time ?? '');
    return [
      { title: 'Запланированные', quests: planned.sort(byDate) },
      { title: 'Повторяющиеся', quests: repeating },
      { title: 'Когда-нибудь', quests: someday },
      { title: 'Завершённые', quests: finished.sort(byDate).reverse() },
    ];
  }, [quests, logs, day]);

  if (!quests) return error ? <p className="error">{error}</p> : <Loader inline />;

  return (
    <section className="card area-inbox">
      <div className="card-header">
        <h2>Квесты</h2>
        <button type="button" className="btn btn-small" onClick={() => setDialog({ quest: null })}>
          + Квест
        </button>
      </div>
      {quests.length === 0 && (
        <p className="muted">
          Квест — небольшое посильное дело: поддержание, развитие, исследование или эксперимент.
          Его всегда можно отложить или отклонить.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {groups.map(
        (group) =>
          group.quests.length > 0 && (
            <div key={group.title}>
              <h3 className="subheading">{group.title}</h3>
              <ul className="someday">
                {group.quests.map((q) => {
                  const status = q.date && q.repeat === 'none' ? logs.get(logKey(q.id, q.date)) : undefined;
                  return (
                    <li key={q.id}>
                      <button
                        type="button"
                        className="quest-main"
                        onClick={() => setDialog({ quest: q })}
                      >
                        <span>{q.title}</span>
                        <span className="muted small">
                          {categoryLabels[q.category]} · {describeSchedule(q)}
                          {status && ` · ${statusLabels[status.status]}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ),
      )}
      <QuestDialog
        open={dialog !== null}
        quest={dialog?.quest}
        day={day}
        onClose={() => setDialog(null)}
        onCreate={add}
        onUpdate={update}
        onDelete={remove}
      />
    </section>
  );
};
