-- Time-on-site reward now requires 15 continuous minutes instead of
-- 15 minutes accumulated over the day. Instead of summing seconds per day we
-- keep the start of the current session; a gap between heartbeats longer than
-- the allowed maximum starts a new session.

drop table public.daily_activity;

create table public.activity_sessions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  started_at timestamptz not null,
  last_heartbeat_at timestamptz not null
);

alter table public.activity_sessions enable row level security;

create policy "activity_sessions: read own" on public.activity_sessions
  for select to authenticated using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.activity_sessions from anon, authenticated;

-- Records a heartbeat from an open, visible tab and grants the time-on-site
-- reward once the current continuous session reaches the threshold.
-- Several open tabs share one session, so they don't speed it up.
create or replace function public.record_heartbeat(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reward constant integer := 10;
  v_required_seconds constant integer := 15 * 60;
  -- Clients beat every 60s; allow some slack for network and timer jitter.
  v_max_gap constant interval := interval '90 seconds';
  v_now timestamptz := now();
  v_today date := (v_now at time zone 'utc')::date;
  v_session public.activity_sessions;
  v_session_seconds integer;
  v_rewarded boolean;
  v_granted boolean := false;
  v_coins bigint;
begin
  -- Lock the profile first so this serializes with claim_daily_reward.
  select coins into v_coins from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile % not found', p_user_id using errcode = 'P0002';
  end if;

  insert into public.activity_sessions as s (user_id, started_at, last_heartbeat_at)
  values (p_user_id, v_now, v_now)
  on conflict (user_id) do update
  set started_at = case
        when v_now - s.last_heartbeat_at > v_max_gap then v_now
        else s.started_at
      end,
      last_heartbeat_at = v_now
  returning * into v_session;

  v_session_seconds := extract(epoch from v_now - v_session.started_at)::integer;

  v_rewarded := exists (
    select 1 from public.coin_transactions
    where user_id = p_user_id and reason = 'time_on_site' and day = v_today
  );

  if not v_rewarded and v_session_seconds >= v_required_seconds then
    insert into public.coin_transactions (user_id, amount, reason, day)
    values (p_user_id, v_reward, 'time_on_site', v_today);

    update public.profiles set coins = coins + v_reward
    where id = p_user_id
    returning coins into v_coins;

    v_rewarded := true;
    v_granted := true;
  end if;

  return jsonb_build_object(
    'session_seconds', v_session_seconds,
    'required_seconds', v_required_seconds,
    'rewarded_today', v_rewarded,
    'granted', v_granted,
    'reward', case when v_granted then v_reward else 0 end,
    'coins', v_coins
  );
end;
$$;
