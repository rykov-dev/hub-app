import { useCallback, useMemo } from 'react';
import {
  type Quest,
  type QuestCategory,
  type QuestLog,
  type QuestPatch,
  type QuestStatus,
  fetchQuestLogs,
  fetchQuests,
} from '../lib/api';
import { addDays, today } from '../lib/dates';
import { applyToQuestLogs, applyToQuests } from '../lib/offline/apply';
import { outbox } from '../lib/offline/outbox';
import { type Occurrence, indexLogs } from '../lib/quests';
import { useSyncedQuery } from './useSyncedQuery';

/** How far back statuses are loaded: enough for "left from earlier days". */
const LOG_DAYS = 60;

const noQuests: Quest[] = [];
const noLogs: QuestLog[] = [];

export type NewQuest = {
  title: string;
  category: QuestCategory;
} & QuestPatch;

/** All the user's quests with recent statuses, plus actions; works offline. */
export const useQuests = (userId: string) => {
  const quests = useSyncedQuery(`${userId}:quests`, fetchQuests, applyToQuests, noQuests);
  // The window moves with the day; a new key just means a new cached query.
  const from = addDays(today(), -LOG_DAYS);
  const logs = useSyncedQuery(
    `${userId}:quest-logs`,
    useCallback(() => fetchQuestLogs(from), [from]),
    applyToQuestLogs,
    noLogs,
  );

  const logIndex = useMemo(() => indexLogs(logs.data ?? []), [logs.data]);

  const add = useCallback((quest: NewQuest) => {
    outbox.enqueue({
      kind: 'addQuest',
      quest: {
        id: crypto.randomUUID(),
        why: null,
        date: null,
        time: null,
        repeat: 'none',
        repeat_until: null,
        created_at: new Date().toISOString(),
        ...quest,
      },
    });
  }, []);

  const update = useCallback(
    (questId: string, patch: QuestPatch) => outbox.enqueue({ kind: 'updateQuest', questId, patch }),
    [],
  );

  const remove = useCallback(
    (questId: string) => outbox.enqueue({ kind: 'deleteQuest', questId }),
    [],
  );

  const setStatus = useCallback(
    (questId: string, day: string, status: QuestStatus | null) =>
      outbox.enqueue({
        kind: 'setQuestStatus',
        questId,
        day,
        status,
        updatedAt: new Date().toISOString(),
      }),
    [],
  );

  /**
   * Marks the day postponed. A one-off quest moves to tomorrow, so it comes
   * back; a repeating one simply comes back on its next day.
   */
  const postpone = useCallback(
    ({ quest, day }: Occurrence) => {
      setStatus(quest.id, day, 'postponed');
      if (quest.repeat === 'none') update(quest.id, { date: addDays(today(), 1) });
    },
    [setStatus, update],
  );

  /** Makes the quest available again that day, undoing a postponed move too. */
  const reopen = useCallback(
    ({ quest, day, log }: Occurrence) => {
      setStatus(quest.id, day, null);
      if (log?.status === 'postponed' && quest.repeat === 'none' && quest.date !== day) {
        update(quest.id, { date: day });
      }
    },
    [setStatus, update],
  );

  return {
    quests: quests.data,
    logs: logIndex,
    error: quests.error ?? logs.error,
    add,
    update,
    remove,
    setStatus,
    postpone,
    reopen,
  };
};
