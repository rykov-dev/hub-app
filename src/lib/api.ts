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

export type InboxNote = {
  id: string;
  body: string;
  tags: string[];
  created_at: string;
};

export type NoteComment = {
  id: string;
  body: string;
  created_at: string;
};

const NOTE_COLUMNS = 'id, body, tags, created_at';

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

/** Its comments go with it (on delete cascade); coins already earned stay. */
export const deleteInboxNote = async (id: string): Promise<void> => {
  const { error } = await supabase.from('inbox_notes').delete().eq('id', id);
  if (error) throw error;
};
