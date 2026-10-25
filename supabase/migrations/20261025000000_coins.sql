-- Coins, daily rewards, streaks and time-on-site rewards.
--
-- All balance changes go through security-definer functions that are only
-- executable by service_role, i.e. only from edge functions. Clients can read
-- their own data but never write coins directly.
--
-- "Day" boundaries are in UTC so a client cannot get extra rewards by changing
-- its timezone.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  coins bigint not null default 0 check (coins >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_daily_claim date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ledger of every coin change. The unique key makes each reward idempotent:
-- a reason can be granted at most once per user per day.
create table public.coin_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null,
  reason text not null check (reason in ('daily_visit', 'streak_bonus', 'time_on_site')),
  day date not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, day)
);

create index coin_transactions_user_created_idx
  on public.coin_transactions (user_id, created_at desc);

-- Per-day active time, accumulated from client heartbeats.
create table public.daily_activity (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  active_seconds integer not null default 0 check (active_seconds >= 0),
  last_heartbeat_at timestamptz,
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------------
-- Profile bootstrap
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.email),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security: users read only their own rows and may only edit
-- display_name. Everything else is written by the reward functions below.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.daily_activity enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "coin_transactions: read own" on public.coin_transactions
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "daily_activity: read own" on public.daily_activity
  for select to authenticated using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;
revoke insert, update, delete on public.coin_transactions from anon, authenticated;
revoke insert, update, delete on public.daily_activity from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reward rules
-- ---------------------------------------------------------------------------

-- Extra coins on top of the daily visit reward for a streak of N days:
-- day 1: +0, day 2: +5, ... day 7 and later: +30.
create function public.streak_bonus(streak integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select least(greatest(streak - 1, 0), 6) * 5;
$$;

-- Grants the once-per-day visit reward and advances the streak.
-- Safe to call on every page load: repeated calls on the same day are no-ops.
create function public.claim_daily_reward(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_daily_reward constant integer := 10;
  v_today date := (now() at time zone 'utc')::date;
  v_profile public.profiles;
  v_streak integer;
  v_bonus integer;
begin
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile % not found', p_user_id using errcode = 'P0002';
  end if;

  if v_profile.last_daily_claim = v_today then
    return jsonb_build_object(
      'claimed', false,
      'coins', v_profile.coins,
      'streak', v_profile.current_streak,
      'reward', 0,
      'streak_bonus', 0
    );
  end if;

  v_streak := case
    when v_profile.last_daily_claim = v_today - 1 then v_profile.current_streak + 1
    else 1
  end;
  v_bonus := public.streak_bonus(v_streak);

  insert into public.coin_transactions (user_id, amount, reason, day)
  values (p_user_id, v_daily_reward, 'daily_visit', v_today);

  if v_bonus > 0 then
    insert into public.coin_transactions (user_id, amount, reason, day)
    values (p_user_id, v_bonus, 'streak_bonus', v_today);
  end if;

  update public.profiles
  set coins = coins + v_daily_reward + v_bonus,
      current_streak = v_streak,
      longest_streak = greatest(longest_streak, v_streak),
      last_daily_claim = v_today
  where id = p_user_id
  returning * into v_profile;

  return jsonb_build_object(
    'claimed', true,
    'coins', v_profile.coins,
    'streak', v_profile.current_streak,
    'reward', v_daily_reward,
    'streak_bonus', v_bonus
  );
end;
$$;

-- Records a heartbeat from an open, visible tab and grants the time-on-site
-- reward once today's active time reaches the threshold.
--
-- Credited time is measured on the server as the gap since the previous
-- heartbeat, capped so that a long gap (closed tab, sleep) counts as a new
-- session rather than active time. Several open tabs therefore don't
-- multiply the credited time.
create function public.record_heartbeat(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reward constant integer := 10;
  v_required_seconds constant integer := 15 * 60;
  -- Clients beat every 60s; allow some slack for throttled background timers.
  v_max_gap_seconds constant integer := 90;
  v_now timestamptz := now();
  v_today date := (v_now at time zone 'utc')::date;
  v_activity public.daily_activity;
  v_gap integer;
  v_rewarded boolean;
  v_granted boolean := false;
  v_coins bigint;
begin
  -- Lock the profile first so this serializes with claim_daily_reward.
  select coins into v_coins from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile % not found', p_user_id using errcode = 'P0002';
  end if;

  insert into public.daily_activity (user_id, day)
  values (p_user_id, v_today)
  on conflict (user_id, day) do nothing;

  select * into v_activity
  from public.daily_activity
  where user_id = p_user_id and day = v_today
  for update;

  v_gap := coalesce(extract(epoch from v_now - v_activity.last_heartbeat_at)::integer, v_max_gap_seconds + 1);

  update public.daily_activity
  set active_seconds = active_seconds + case when v_gap <= v_max_gap_seconds then v_gap else 0 end,
      last_heartbeat_at = v_now
  where user_id = p_user_id and day = v_today
  returning * into v_activity;

  v_rewarded := exists (
    select 1 from public.coin_transactions
    where user_id = p_user_id and reason = 'time_on_site' and day = v_today
  );

  if not v_rewarded and v_activity.active_seconds >= v_required_seconds then
    insert into public.coin_transactions (user_id, amount, reason, day)
    values (p_user_id, v_reward, 'time_on_site', v_today);

    update public.profiles set coins = coins + v_reward
    where id = p_user_id
    returning coins into v_coins;

    v_rewarded := true;
    v_granted := true;
  end if;

  return jsonb_build_object(
    'active_seconds', v_activity.active_seconds,
    'required_seconds', v_required_seconds,
    'rewarded_today', v_rewarded,
    'granted', v_granted,
    'reward', case when v_granted then v_reward else 0 end,
    'coins', v_coins
  );
end;
$$;

revoke execute on function public.claim_daily_reward(uuid) from public, anon, authenticated;
revoke execute on function public.record_heartbeat(uuid) from public, anon, authenticated;
grant execute on function public.claim_daily_reward(uuid) to service_role;
grant execute on function public.record_heartbeat(uuid) to service_role;
