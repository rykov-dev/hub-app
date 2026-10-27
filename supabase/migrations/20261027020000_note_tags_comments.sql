-- Opening a note: tags and comments. Neither earns coins; the only reward
-- stays the one for creating a note (inbox_notes_reward, insert only).

-- Tags are stored normalized (lowercase, trimmed); the client normalizes
-- them, this guards against anything else reaching the table.
create function public.valid_tags(tags text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(char_length(t) between 1 and 40 and t = lower(btrim(t))), true)
  from unnest(tags) as t;
$$;

alter table public.inbox_notes
  add column tags text[] not null default '{}'
    check (cardinality(tags) <= 20 and public.valid_tags(tags));

create index inbox_notes_tags_idx on public.inbox_notes using gin (tags);

-- Tags are the only part of a note the user can change.
grant update (tags) on public.inbox_notes to authenticated;

create policy "inbox_notes: update own" on public.inbox_notes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table public.inbox_note_comments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.inbox_notes (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (length(btrim(body)) > 0 and length(body) <= 5000),
  created_at timestamptz not null default now()
);

create index inbox_note_comments_note_created_idx
  on public.inbox_note_comments (note_id, created_at);

alter table public.inbox_note_comments enable row level security;

create policy "inbox_note_comments: read own" on public.inbox_note_comments
  for select to authenticated using ((select auth.uid()) = user_id);

-- Only on the user's own notes.
create policy "inbox_note_comments: insert own" on public.inbox_note_comments
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.inbox_notes n
      where n.id = note_id and n.user_id = (select auth.uid())
    )
  );

create policy "inbox_note_comments: delete own" on public.inbox_note_comments
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.inbox_note_comments from anon;
revoke update on public.inbox_note_comments from authenticated;
