-- Retire the legacy client-encrypted Vault integration.
-- Keep previous migrations as applied history; remove only obsolete capabilities.
-- Existing Storage objects are NOT deleted here. Empty/remove the private
-- 'vault' bucket using the Supabase Storage API or Dashboard.
-- Read docs/vault-migration.md before deploying to a project running the old client.

drop function if exists public.import_legacy_vault_note(uuid, text, text[], timestamptz);
drop function if exists public.set_vault_key(text);

alter table public.profiles
  drop column if exists vault_key_fingerprint;

drop policy if exists "vault: read own" on storage.objects;
drop policy if exists "vault: insert own" on storage.objects;
drop policy if exists "vault: update own" on storage.objects;
drop policy if exists "vault: delete own" on storage.objects;

-- Intentionally preserve the Storage bucket and contents until an explicit wipe.
-- Never DELETE FROM storage.objects directly.
