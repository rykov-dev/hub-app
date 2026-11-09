import { supabase } from './supabase';

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  coins: number;
  current_streak: number;
  longest_streak: number;
  last_daily_claim: string | null;
};

export type CoinTransaction = {
  id: number;
  amount: number;
  reason: 'daily_visit' | 'streak_bonus' | 'time_on_site' | 'inbox_note' | 'spend';
  /** What coins were spent on. */
  description: string | null;
  day: string;
  created_at: string;
};

export const ENTRY_KINDS = ['note', 'event', 'link', 'expense', 'food'] as const;
/** Chosen when an entry is created; never changes. */
export type EntryKind = (typeof ENTRY_KINDS)[number];

export type InboxNote = {
  id: string;
  body: string;
  tags: string[];
  kind: EntryKind;
  /** Storage path of the attached image ('<user id>/<note id>'), if any. */
  image_path: string | null;
  /** When it happened; set on creation, editable later. */
  created_at: string;
};

/** The parts of an entry that can be edited (tags have their own change). */
export type NotePatch = Partial<Pick<InboxNote, 'body' | 'created_at'>>;

export type NoteComment = {
  id: string;
  body: string;
  created_at: string;
};

const NOTE_COLUMNS = 'id, body, tags, kind, image_path, created_at';

export type DailyClaimResult = {
  claimed: boolean;
  coins: number;
  streak: number;
  reward: number;
  streak_bonus: number;
};

const invoke = async <T>(name: string, body?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke<T>(name, { method: 'POST', body });
  if (error) throw error;
  return data as T;
};

export const claimDaily = () => invoke<DailyClaimResult>('claim-daily');

export const fetchProfile = async (): Promise<Profile> => {
  const { data, error } = await supabase.from('profiles').select('*').single();
  if (error) throw error;
  return data;
};

export const fetchTransactions = async (limit = 10): Promise<CoinTransaction[]> => {
  const { data, error } = await supabase
    .from('coin_transactions')
    .select('id, amount, reason, description, day, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
};

export const fetchInboxNotes = async (limit = 100): Promise<InboxNote[]> => {
  const { data, error } = await supabase
    .from('inbox_notes')
    .select(NOTE_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
};

/** Entries in [from, to), oldest first. */
export const fetchInboxNotesBetween = async (from: string, to: string): Promise<InboxNote[]> => {
  const { data, error } = await supabase
    .from('inbox_notes')
    .select(NOTE_COLUMNS)
    .gte('created_at', from)
    .lt('created_at', to)
    .order('created_at');
  if (error) throw error;
  return data;
};

/**
 * Ids and timestamps come from the client so a note created offline keeps
 * them, and a retried insert hits the primary key instead of duplicating.
 */
export const insertInboxNote = async (note: InboxNote): Promise<void> => {
  const { error } = await supabase.from('inbox_notes').insert(note);
  if (error) throw error;
};

export const fetchInboxNote = async (id: string): Promise<InboxNote | null> => {
  const { data, error } = await supabase
    .from('inbox_notes')
    .select(NOTE_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const updateInboxNote = async (id: string, patch: NotePatch): Promise<void> => {
  const { error } = await supabase.from('inbox_notes').update(patch).eq('id', id);
  if (error) throw error;
};

export const updateNoteTags = async (id: string, tags: string[]): Promise<void> => {
  const { error } = await supabase.from('inbox_notes').update({ tags }).eq('id', id);
  if (error) throw error;
};

export const fetchNoteComments = async (noteId: string): Promise<NoteComment[]> => {
  const { data, error } = await supabase
    .from('inbox_note_comments')
    .select('id, body, created_at')
    .eq('note_id', noteId)
    .order('created_at');
  if (error) throw error;
  return data;
};

export const insertNoteComment = async (noteId: string, comment: NoteComment): Promise<void> => {
  const { error } = await supabase.from('inbox_note_comments').insert({ ...comment, note_id: noteId });
  if (error) throw error;
};

export type NoteCommentWithNote = NoteComment & { note_id: string };

export const fetchCommentsForNotes = async (noteIds: string[]): Promise<NoteCommentWithNote[]> => {
  if (noteIds.length === 0) return [];
  const { data, error } = await supabase
    .from('inbox_note_comments')
    .select('id, note_id, body, created_at')
    .in('note_id', noteIds)
    .order('created_at');
  if (error) throw error;
  return data;
};

/**
 * Its comments go with it (on delete cascade); coins already earned stay.
 * The image goes first, so a retry after a lost response can't leave it behind.
 */
export const deleteInboxNote = async (id: string, imagePath: string | null): Promise<void> => {
  if (imagePath) await removeImage(imagePath);
  const { error } = await supabase.from('inbox_notes').delete().eq('id', id);
  if (error) throw error;
};

// Images ------------------------------------------------------------------

const IMAGES = 'attachments';

export const imagePathFor = (userId: string, noteId: string) => `${userId}/${noteId}`;

/** Upsert, so a retried upload replaces a partial one instead of failing. */
export const uploadImage = async (path: string, image: Blob): Promise<void> => {
  const { error } = await supabase.storage
    .from(IMAGES)
    .upload(path, image, { upsert: true, contentType: image.type });
  if (error) throw error;
};

export const downloadImage = async (path: string): Promise<Blob> => {
  const { data, error } = await supabase.storage.from(IMAGES).download(path);
  if (error) throw error;
  return data;
};

export const removeImage = async (path: string): Promise<void> => {
  const { error } = await supabase.storage.from(IMAGES).remove([path]);
  if (error) throw error;
};

// Quests ------------------------------------------------------------------

export const QUEST_CATEGORIES = ['maintenance', 'growth', 'exploration', 'experiment'] as const;
export type QuestCategory = (typeof QUEST_CATEGORIES)[number];

export const QUEST_REPEATS = ['none', 'daily', 'weekdays', 'weekly', 'monthly'] as const;
export type QuestRepeat = (typeof QUEST_REPEATS)[number];

export type Quest = {
  id: string;
  title: string;
  /** Chosen when a quest is created; never changes. */
  category: QuestCategory;
  why: string | null;
  /** Local date 'YYYY-MM-DD'; null means "some day", not planned yet. */
  date: string | null;
  /** Local time 'HH:MM' or 'HH:MM:SS'; null means all day. */
  time: string | null;
  repeat: QuestRepeat;
  /** Last day a repeating quest occurs on; null means no end. */
  repeat_until: string | null;
  created_at: string;
};

export type QuestPatch = Partial<
  Pick<Quest, 'title' | 'why' | 'date' | 'time' | 'repeat' | 'repeat_until'>
>;

export type QuestStatus = 'done' | 'postponed' | 'declined';

/** What happened to a quest on a day; no log means it's still available. */
export type QuestLog = {
  quest_id: string;
  day: string;
  status: QuestStatus;
  updated_at: string;
};

const QUEST_COLUMNS = 'id, title, category, why, date, time, repeat, repeat_until, created_at';

export const fetchQuests = async (): Promise<Quest[]> => {
  const { data, error } = await supabase
    .from('quests')
    .select(QUEST_COLUMNS)
    .order('created_at');
  if (error) throw error;
  return data;
};

export const insertQuest = async (quest: Quest): Promise<void> => {
  const { error } = await supabase.from('quests').insert(quest);
  if (error) throw error;
};

export const updateQuest = async (id: string, patch: QuestPatch): Promise<void> => {
  const { error } = await supabase.from('quests').update(patch).eq('id', id);
  if (error) throw error;
};

/** Its logs go with it (on delete cascade). */
export const deleteQuest = async (id: string): Promise<void> => {
  const { error } = await supabase.from('quests').delete().eq('id', id);
  if (error) throw error;
};

/** Logs from `from` (a local date) on. */
export const fetchQuestLogs = async (from: string): Promise<QuestLog[]> => {
  const { data, error } = await supabase
    .from('quest_logs')
    .select('quest_id, day, status, updated_at')
    .gte('day', from)
    .order('day');
  if (error) throw error;
  return data;
};

export const fetchQuestLogsBetween = async (from: string, to: string): Promise<QuestLog[]> => {
  const { data, error } = await supabase
    .from('quest_logs')
    .select('quest_id, day, status, updated_at')
    .gte('day', from)
    .lte('day', to)
    .order('updated_at');
  if (error) throw error;
  return data;
};

/** Sets the status for that day; null makes the quest available again. */
export const setQuestStatus = async (log: QuestLog | { quest_id: string; day: string; status: null }) => {
  if (log.status === null) {
    const { error } = await supabase
      .from('quest_logs')
      .delete()
      .eq('quest_id', log.quest_id)
      .eq('day', log.day);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('quest_logs').upsert(log, { onConflict: 'quest_id,day' });
  if (error) throw error;
};

// Day starts ------------------------------------------------------------------

export type DayStart = {
  /** Local date 'YYYY-MM-DD'. */
  day: string;
  started_at: string;
};

export const fetchDayStarts = async (from: string, to: string): Promise<DayStart[]> => {
  const { data, error } = await supabase
    .from('day_starts')
    .select('day, started_at')
    .gte('day', from)
    .lte('day', to)
    .order('day');
  if (error) throw error;
  return data;
};

export const insertDayStart = async (start: DayStart): Promise<void> => {
  const { error } = await supabase.from('day_starts').insert(start);
  if (error) throw error;
};
