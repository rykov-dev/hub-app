-- MANUAL OPERATION ONLY. Do not put this file in supabase/migrations.
-- Run only after the deployed release has switched away from encrypted Vault.
-- Preserves auth.users, OAuth identities, profiles, schema, RLS and migrations.
-- Deletes all user-generated Inbox, chats, activity, coin history and resets counters.
-- To remove old encrypted .bin objects, empty the private Supabase Storage bucket
-- "vault" using the Storage API or Supabase Dashboard BEFORE deleting the bucket.
-- Storage objects must not be deleted with direct SQL.
--
-- This script is intentionally not part of the automatic deploy.
-- Execute manually from Supabase SQL Editor after inspecting the environment.

begin;

truncate table
  public.chat_messages,
  public.chats,
  public.inbox_note_comments,
  public.inbox_notes,
  public.coin_transactions,
  public.daily_activity,
  public.activity_sessions
restart identity;

update public.profiles set
  coins = 0,
  current_streak = 0,
  longest_streak = 0,
  last_daily_claim = null;

commit;
