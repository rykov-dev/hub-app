import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { LinkifiedText } from '../components/LinkifiedText';
import { Loader } from '../components/Loader';
import { NoteImage } from '../components/NoteImage';
import { TagList } from '../components/TagList';
import { useQuests } from '../hooks/useQuests';
import { useSyncedQuery } from '../hooks/useSyncedQuery';
import { useAppContext } from '../layouts/AppLayout';
import {
  type DayStart,
  type InboxNote,
  type QuestLog,
  fetchCommentsForNotes,
  fetchDayStarts,
  fetchInboxNotesBetween,
  fetchQuestLogsBetween,
} from '../lib/api';
import { addDays, dayOf, formatDay, formatTime, parseDay } from '../lib/dates';
import { buildFeed, download, toJson, toMarkdown } from '../lib/export';
import { applyToDayStarts, applyToNotes, applyToQuestLogs } from '../lib/offline/apply';
import { categoryLabels, entryKindLabels, statusLabels } from '../lib/quests';

const noNotes: InboxNote[] = [];
const noLogs: QuestLog[] = [];
const noStarts: DayStart[] = [];

/** Everything that happened over a range of days in one feed, with export. */
export const HistoryPage = () => {
  const { profile, day } = useAppContext();
  const [from, setFrom] = useState(() => addDays(day, -6));
  const [to, setTo] = useState(day);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const range = `${from}:${to}`;

  const notesQuery = useSyncedQuery(
    `${profile.id}:history-notes:${range}`,
    useCallback(
      () =>
        fetchInboxNotesBetween(
          parseDay(from).toISOString(),
          parseDay(addDays(to, 1)).toISOString(),
        ),
      [from, to],
    ),
    applyToNotes,
    noNotes,
  );
  const logsQuery = useSyncedQuery(
    `${profile.id}:history-logs:${range}`,
    useCallback(() => fetchQuestLogsBetween(from, to), [from, to]),
    applyToQuestLogs,
    noLogs,
  );
  const startsQuery = useSyncedQuery(
    `${profile.id}:history-starts:${range}`,
    useCallback(() => fetchDayStarts(from, to), [from, to]),
    applyToDayStarts,
    noStarts,
  );
  const { quests } = useQuests(profile.id, day);

  // Pending changes can bring in entries from outside the range.
  const inRange = useCallback((d: string) => d >= from && d <= to, [from, to]);
  const notes = useMemo(
    () => notesQuery.data?.filter((n) => inRange(dayOf(n.created_at))),
    [notesQuery.data, inRange],
  );
  const logs = useMemo(() => logsQuery.data?.filter((l) => inRange(l.day)), [logsQuery.data, inRange]);
  const starts = useMemo(
    () => startsQuery.data?.filter((s) => inRange(s.day)),
    [startsQuery.data, inRange],
  );

  const feed = useMemo(
    () => (notes && logs && starts ? buildFeed(notes, logs, starts, quests ?? []) : undefined),
    [notes, logs, starts, quests],
  );
  const error = notesQuery.error ?? logsQuery.error ?? startsQuery.error;

  const counts = useMemo(() => {
    const byKind = new Map<string, number>();
    for (const n of notes ?? []) {
      const label = entryKindLabels[n.kind];
      byKind.set(label, (byKind.get(label) ?? 0) + 1);
    }
    const byStatus = new Map<string, number>();
    for (const l of logs ?? []) {
      byStatus.set(statusLabels[l.status], (byStatus.get(statusLabels[l.status]) ?? 0) + 1);
    }
    return { byKind: [...byKind], byStatus: [...byStatus], days: starts?.length ?? 0 };
  }, [notes, logs, starts]);

  const exportAs = async (format: 'md' | 'json') => {
    if (!notes || !logs || !starts || !feed) return;
    setExportError(null);
    setExporting(true);
    try {
      let comments: Awaited<ReturnType<typeof fetchCommentsForNotes>> = [];
      try {
        comments = await fetchCommentsForNotes(notes.map((n) => n.id));
      } catch {
        setExportError('Комментарии не загрузились (нет сети?) — экспорт без них.');
      }
      const name = `hub-app-${from}_${to}`;
      if (format === 'md') {
        download(`${name}.md`, toMarkdown(from, to, feed, comments), 'text/markdown');
      } else {
        const used = new Set(logs.map((l) => l.quest_id));
        const data = {
          notes,
          comments,
          logs,
          starts,
          quests: (quests ?? []).filter((q) => used.has(q.id)),
        };
        download(`${name}.json`, toJson(from, to, data), 'application/json');
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="card area-inbox">
      <h2>История</h2>
      <div className="field-row">
        <label className="field">
          <span className="muted small">С</span>
          <input
            type="date"
            className="input"
            max={to}
            value={from}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="muted small">По</span>
          <input
            type="date"
            className="input"
            min={from}
            value={to}
            onChange={(e) => e.target.value && setTo(e.target.value)}
          />
        </label>
      </div>
      <div className="chips">
        <button type="button" className="chip" onClick={() => (setFrom(addDays(day, -6)), setTo(day))}>
          7 дней
        </button>
        <button type="button" className="chip" onClick={() => (setFrom(addDays(day, -29)), setTo(day))}>
          30 дней
        </button>
      </div>
      <div className="chips">
        <span className="muted small">Экспорт:</span>
        <button
          type="button"
          className="btn btn-small"
          disabled={!feed || exporting}
          onClick={() => exportAs('md')}
        >
          Markdown
        </button>
        <button
          type="button"
          className="btn btn-small"
          disabled={!feed || exporting}
          onClick={() => exportAs('json')}
        >
          JSON
        </button>
      </div>
      {exportError && <p className="error">{exportError}</p>}
      {error && <p className="error">{error}</p>}

      {!feed ? (
        <Loader inline />
      ) : (
        <>
          <p className="muted small">
            Дней с входом: {counts.days}
            {counts.byKind.length > 0 &&
              ` · записи: ${counts.byKind.map(([k, n]) => `${k.toLowerCase()} ${n}`).join(', ')}`}
            {counts.byStatus.length > 0 &&
              ` · квесты: ${counts.byStatus.map(([k, n]) => `${k} ${n}`).join(', ')}`}
          </p>
          {feed.length === 0 && <p className="muted">За эти дни ничего нет.</p>}
          {feed.map(([d, events]) => (
            <div key={d} className="history-day">
              <h3 className="subheading">{formatDay(d)}</h3>
              <ul className="feed">
                {events.map((e) => (
                  <li key={`${e.type}:${e.type === 'entry' ? e.note.id : e.type === 'quest' ? e.log.quest_id : e.day}`}>
                    <time className="muted small feed-time" dateTime={e.at}>
                      {formatTime(e.at)}
                    </time>
                    {e.type === 'start' && <span className="muted">Начало дня</span>}
                    {e.type === 'quest' && (
                      <span>
                        Квест «{e.quest?.title ?? 'удалён'}»
                        <span className="muted">
                          {e.quest && ` · ${categoryLabels[e.quest.category]}`} ·{' '}
                          {statusLabels[e.log.status]}
                        </span>
                      </span>
                    )}
                    {e.type === 'entry' && (
                      <div className="feed-entry">
                        <Link to={`/inbox/${e.note.id}`} className="muted small kind-label">
                          {entryKindLabels[e.note.kind]}
                        </Link>
                        {e.note.body && <LinkifiedText className="note-body" text={e.note.body} />}
                        <NoteImage userId={profile.id} path={e.note.image_path} thumbnail />
                        <TagList tags={e.note.tags} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
};
