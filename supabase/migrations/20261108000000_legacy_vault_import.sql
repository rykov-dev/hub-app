-- Import old encrypted Vault notes without minting new coins for historical data.
-- Existing note IDs are never overwritten; repeated imports are no-ops.
-- Regular inbox inserts continue to earn coins through reward_inbox_note.

create function public.import_legacy_vault_note(
  p_id uuid,
  p_body text,
  p_tags text[],
  p_created_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_inserted uuid;
  v_reward bigint;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  -- Only an account that has initialized the old vault may use this path.
  if not exists (
    select 1 from public.profiles
    where id = v_user_id and vault_key_fingerprint is not null
  ) then
    raise exception 'legacy_vault_not_configured';
  end if;
  -- Historical import only; never use this to create new regular notes.
  if p_created_at > now() then
    raise exception 'invalid_created_at';
  end if;

  insert into public.inbox_notes (id, user_id, body, tags, created_at)
  values (p_id, v_user_id, p_body, p_tags, p_created_at)
  on conflict (id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    -- Do not silently claim ownership of conflicting note IDs.
    if not exists (select 1 from public.inbox_notes where id = p_id and user_id = v_user_id) then
      raise exception 'note_id_conflict';
    end if;
    return false;
  end if;

  -- The normal AFTER INSERT trigger already awarded coins. Reverse it in
  -- the same transaction so imported historical notes do not earn rewards.
  select coalesce(sum(amount), 0) into v_reward
  from public.coin_transactions
  where user_id = v_user_id and inbox_note_id = p_id and reason = 'inbox_note';

  update public.profiles set coins = coins - v_reward where id = v_user_id;
  delete from public.coin_transactions
  where user_id = v_user_id and inbox_note_id = p_id and reason = 'inbox_note';

  return true;
end;
$$;

revoke execute on function public.import_legacy_vault_note(uuid,text,text[],timestamptz)
  from public, anon;
grant execute on function public.import_legacy_vault_note(uuid,text,text[],timestamptz)
  to authenticated;
