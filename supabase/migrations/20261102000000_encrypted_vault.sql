-- Encrypted vault: the user's notes and comments are encrypted on the device
-- with a key only the user has (a key file) and stored as objects in Storage.
-- The server keeps ciphertext only, plus the key's fingerprint so a device can
-- check that a loaded key file belongs to this account.

-- Private bucket; each user owns the folder named after their id.
insert into storage.buckets (id, name, public, file_size_limit)
values ('vault', 'vault', false, 1048576)
on conflict (id) do nothing;

create policy "vault: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'vault' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "vault: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vault' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Upserts (rewriting a note) need update as well as insert.
create policy "vault: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'vault' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'vault' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "vault: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vault' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 'SHA256:<base64>' of the raw key, like an SSH key fingerprint. It reveals
-- nothing about the key (256 random bits).
alter table public.profiles
  add column vault_key_fingerprint text
    check (vault_key_fingerprint ~ '^SHA256:[A-Za-z0-9+/]{43}$');

-- The fingerprint is set once: replacing it would lock the user out of
-- everything encrypted with the first key. Repeating the same one is fine,
-- so a retried request succeeds.
create function public.set_vault_key(p_fingerprint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
begin
  select vault_key_fingerprint into v_current
  from public.profiles where id = auth.uid() for update;

  if not found then
    raise exception 'no_profile';
  end if;
  if v_current is not null and v_current <> p_fingerprint then
    raise exception 'vault_key_already_set';
  end if;

  update public.profiles set vault_key_fingerprint = p_fingerprint where id = auth.uid();
end;
$$;

revoke execute on function public.set_vault_key(text) from public, anon;
grant execute on function public.set_vault_key(text) to authenticated;
