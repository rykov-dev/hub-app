-- Adding a note to the inbox earns 1 coin per character of the note.
-- The reward is granted by a trigger, so it can't be skipped or faked by the
-- client: inserting a note is the only way to earn it.

-- Many notes per day are allowed, so "once per reason per day" now applies
-- only to the daily rewards.
alter table public.coin_transactions
  drop constraint coin_transactions_user_id_reason_day_key,
  drop constraint coin_transactions_reason_check,
  add constraint coin_transactions_reason_check
    check (reason in ('daily_visit', 'streak_bonus', 'time_on_site', 'inbox_note')),
  -- Kept when the note is deleted: coins already earned stay earned.
  add column inbox_note_id uuid references public.inbox_notes (id) on delete set null;

create unique index coin_transactions_daily_reward_key
  on public.coin_transactions (user_id, reason, day)
  where reason in ('daily_visit', 'streak_bonus', 'time_on_site');

create function public.reward_inbox_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Same count as the client: edge whitespace (not just spaces) is not paid for.
  v_amount integer := char_length(btrim(new.body, E' \t\n\r\f' || chr(11)));
begin
  if v_amount = 0 then
    return new;
  end if;

  -- Profile first, matching the lock order of the other reward functions.
  update public.profiles set coins = coins + v_amount where id = new.user_id;

  insert into public.coin_transactions (user_id, amount, reason, day, inbox_note_id)
  values (new.user_id, v_amount, 'inbox_note', (now() at time zone 'utc')::date, new.id);

  return new;
end;
$$;

create trigger inbox_notes_reward
  after insert on public.inbox_notes
  for each row execute function public.reward_inbox_note();
