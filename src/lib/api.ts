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
  reason: 'daily_visit' | 'streak_bonus' | 'time_on_site';
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
    .select('id, amount, reason, day, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
};
