import { supabase } from './supabase';

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  coins: number;
  current_streak: number;
  longest_streak: number;
  last_daily_claim: string | null;
  /** Fingerprint of the user's vault key; null until the vault is set up. */
  vault_key_fingerprint: string | null;
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

/** Registers the fingerprint of the user's vault key; it can be set only once. */
export const setVaultKey = async (fingerprint: string): Promise<void> => {
  const { error } = await supabase.rpc('set_vault_key', { p_fingerprint: fingerprint });
  if (error) throw error;
};

// Notes from before the vault were stored as plain text in the database.
// They are read once to move them into the vault, then deleted.

export type LegacyNote = { id: string; body: string; tags: string[]; created_at: string };
export type LegacyComment = { id: string; note_id: string; body: string; created_at: string };

const LEGACY_PAGE = 1000;

const fetchAll = async <T>(table: string, columns: string): Promise<T[]> => {
  const rows: T[] = [];
  for (let from = 0; ; from += LEGACY_PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order('created_at')
      .range(from, from + LEGACY_PAGE - 1);
    if (error) throw error;
    rows.push(...(data as T[]));
    if (data.length < LEGACY_PAGE) return rows;
  }
};

export const fetchLegacyNotes = () =>
  fetchAll<LegacyNote>('inbox_notes', 'id, body, tags, created_at');

export const fetchLegacyComments = () =>
  fetchAll<LegacyComment>('inbox_note_comments', 'id, note_id, body, created_at');

/** Their comments go with them (on delete cascade); coins already earned stay. */
export const deleteLegacyNotes = async (ids: string[]): Promise<void> => {
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await supabase.from('inbox_notes').delete().in('id', ids.slice(i, i + 100));
    if (error) throw error;
  }
};
