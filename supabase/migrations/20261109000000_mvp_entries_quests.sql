-- MVP 0.1: typed Inbox entries with an optional image, quests with
-- per-day statuses, and the start of each day (the first visit that day).

-- Entries ---------------------------------------------------------------

-- The kind is chosen when an entry is created and never changes. The image
-- lives in Storage at '<user_id>/<entry id>' (bucket 'attachments').
alter table public.inbox_notes
  add column kind text not null default 'note'
    check (kind in ('note', 'event', 'link', 'expense', 'food')),
  add column image_path text
    check (image_path is null or image_path = user_id::text || '/' || id::text);

-- An entry with an image may have no text.
alter table public.inbox_notes drop constraint inbox_notes_body_check;
alter table public.inbox_notes add constraint inbox_notes_body_check
  check (length(body) <= 10000 and (length(btrim(body)) > 0 or image_path is not null));

-- Text and date/time are editable, as tags already are; kind and image are not.
grant update (body, created_at) on public.inbox_notes to authenticated;

-- Private bucket for entry images; each user owns the folder named after their id.
-- The client downsizes images before upload, so 5 MiB is plenty.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "attachments: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "attachments: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- A retried upload (upsert) needs update as well as insert.
create policy "attachments: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "attachments: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Quests ----------------------------------------------------------------

-- Like a calendar event: an optional date (none = "some day"), an optional
-- time (none = all day) and a repeat rule. Dates and times are the user's
-- local ones. The category is chosen once, like an entry's kind.
create table public.quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  category text not null
    check (category in ('maintenance', 'growth', 'exploration', 'experiment')),
  why text check (why is null or length(why) <= 2000),
  date date,
  time time,
  "repeat" text not null default 'none'
    check ("repeat" in ('none', 'daily', 'weekdays', 'weekly', 'monthly')),
  repeat_until date,
  created_at timestamptz not null default now(),
  check ("repeat" = 'none' or date is not null),
  check (time is null or date is not null),
  check (repeat_until is null or repeat_until >= date)
);

create index quests_user_idx on public.quests (user_id);

alter table public.quests enable row level security;

create policy "quests: read own" on public.quests
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "quests: insert own" on public.quests
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "quests: update own" on public.quests
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "quests: delete own" on public.quests
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.quests from anon;
revoke update on public.quests from authenticated;
grant update (title, why, date, time, "repeat", repeat_until) on public.quests to authenticated;

-- What happened to a quest on a given day. No row means it is still available.
create table public.quest_logs (
  quest_id uuid not null references public.quests (id) on delete cascade,
  day date not null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status text not null check (status in ('done', 'postponed', 'declined')),
  updated_at timestamptz not null default now(),
  primary key (quest_id, day)
);

create index quest_logs_user_day_idx on public.quest_logs (user_id, day);

alter table public.quest_logs enable row level security;

create policy "quest_logs: read own" on public.quest_logs
  for select to authenticated using ((select auth.uid()) = user_id);
-- Only for the user's own quests.
create policy "quest_logs: insert own" on public.quest_logs
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.quests q
      where q.id = quest_id and q.user_id = (select auth.uid())
    )
  );
create policy "quest_logs: update own" on public.quest_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.quests q
      where q.id = quest_id and q.user_id = (select auth.uid())
    )
  );
create policy "quest_logs: delete own" on public.quest_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.quest_logs from anon;
revoke update on public.quest_logs from authenticated;
-- The client upserts a whole row, which updates every column it sends.
grant update (quest_id, day, status, updated_at) on public.quest_logs to authenticated;

-- Day starts ------------------------------------------------------------

-- The first time the app was opened on each local day. Written once.
create table public.day_starts (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null,
  started_at timestamptz not null,
  primary key (user_id, day)
);

alter table public.day_starts enable row level security;

create policy "day_starts: read own" on public.day_starts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "day_starts: insert own" on public.day_starts
  for insert to authenticated with check ((select auth.uid()) = user_id);

revoke all on public.day_starts from anon;
revoke update, delete on public.day_starts from authenticated;
