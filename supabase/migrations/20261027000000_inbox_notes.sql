-- Inbox: quick-capture notes the user sorts out later.
-- Notes don't affect coins, so the client reads and writes them directly
-- through RLS instead of going through an edge function.

create table public.inbox_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (length(btrim(body)) > 0 and length(body) <= 10000),
  created_at timestamptz not null default now()
);

create index inbox_notes_user_created_idx on public.inbox_notes (user_id, created_at desc);

alter table public.inbox_notes enable row level security;

create policy "inbox_notes: read own" on public.inbox_notes
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "inbox_notes: insert own" on public.inbox_notes
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "inbox_notes: delete own" on public.inbox_notes
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.inbox_notes from anon;
revoke update on public.inbox_notes from authenticated;
