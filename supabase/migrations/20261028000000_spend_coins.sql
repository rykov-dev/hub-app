-- Spending coins. The game world (project-25, embedded in an iframe) keeps its
-- own catalog and prices and asks the app to spend coins; this only checks the
-- balance and records the spending. Spending can only lower the balance, so the
-- amount the world asks for is accepted as is.

alter table public.coin_transactions
  drop constraint coin_transactions_reason_check,
  add constraint coin_transactions_reason_check
    check (reason in ('daily_visit', 'streak_bonus', 'time_on_site', 'inbox_note', 'spend')),
  -- What the coins were spent on, as the world described it.
  add column description text check (char_length(description) <= 200),
  -- The world's request id: a retried request is not charged twice.
  add column request_id text check (char_length(request_id) <= 100);

create unique index coin_transactions_request_key
  on public.coin_transactions (user_id, request_id)
  where request_id is not null;

-- Raises 'not_enough_coins' when the balance is too low and 'invalid_amount'
-- for a non-positive or absurd amount. Returns the new balance.
create function public.spend_coins(p_amount integer, p_description text, p_request_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_coins bigint;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_amount is null or p_amount not between 1 and 1000000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- Profile first, matching the lock order of the reward functions.
  select coins into v_coins from public.profiles where id = v_user for update;

  if exists (
    select 1 from public.coin_transactions
    where user_id = v_user and request_id = p_request_id
  ) then
    return jsonb_build_object('coins', v_coins, 'charged', 0);
  end if;

  if v_coins < p_amount then
    raise exception 'not_enough_coins' using errcode = 'P0001';
  end if;

  update public.profiles set coins = coins - p_amount
  where id = v_user
  returning coins into v_coins;

  insert into public.coin_transactions (user_id, amount, reason, day, description, request_id)
  values (
    v_user,
    -p_amount,
    'spend',
    (now() at time zone 'utc')::date,
    left(btrim(p_description), 200),
    left(p_request_id, 100)
  );

  return jsonb_build_object('coins', v_coins, 'charged', p_amount);
end;
$$;

revoke execute on function public.spend_coins(integer, text, text) from public, anon;
grant execute on function public.spend_coins(integer, text, text) to authenticated;
