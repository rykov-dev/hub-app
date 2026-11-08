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

export type Chat = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type SavedChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type DailyClaimResult = {
  claimed: boolean;
  coins: number;
  streak: number;
  reward: number;
  streak_bonus: number;
};

export type HeartbeatResult = {
  /** Length of the current continuous session. */
  session_seconds: number;
  required_seconds: number;
  rewarded_today: boolean;
  granted: boolean;
  reward: number;
  coins: number;
};

const invoke = async <T>(name: string, body?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke<T>(name, { method: 'POST', body });
  if (error) throw error;
  return data as T;
};

export const claimDaily = () => invoke<DailyClaimResult>('claim-daily');
export const sendHeartbeat = () => invoke<HeartbeatResult>('heartbeat');
export const endSession = () => invoke<{ ended: true }>('heartbeat', { leave: true });

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

export const fetchChats = async (limit = 100): Promise<Chat[]> => {
  const { data, error } = await supabase
    .from('chats')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
};

export const fetchChatMessages = async (chatId: string): Promise<SavedChatMessage[]> => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('chat_id', chatId)
    .order('created_at');
  if (error) throw error;
  return data;
};

/** Like notes, chats and messages get their ids and timestamps on the client. */
export const insertChat = async (chat: Chat): Promise<void> => {
  const { error } = await supabase.from('chats').insert(chat);
  if (error) throw error;
};

export const insertChatMessage = async (chatId: string, message: SavedChatMessage): Promise<void> => {
  const { error } = await supabase.from('chat_messages').insert({ ...message, chat_id: chatId });
  if (error) throw error;
};

/**
 * Spends coins on the server; a retry with the same request id is not
 * charged twice. Returns the new balance.
 */
export const spendCoins = async (
  amount: number,
  description: string,
  requestId: string,
): Promise<number> => {
  const { data, error } = await supabase.rpc('spend_coins', {
    p_amount: amount,
    p_description: description,
    p_request_id: requestId,
  });
  if (error) throw error;
  return (data as { coins: number }).coins;
};
