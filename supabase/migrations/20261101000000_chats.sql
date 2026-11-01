-- Saved chats with the assistant. Chatting earns no coins, so the client reads
-- and writes them directly through RLS, like inbox notes. Ids and timestamps
-- come from the client so chats written offline keep them.

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (length(btrim(title)) > 0 and length(title) <= 200),
  created_at timestamptz not null default now(),
  -- Time of the last message; chats are listed by it.
  updated_at timestamptz not null default now()
);

create index chats_user_updated_idx on public.chats (user_id, updated_at desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(btrim(content)) > 0 and length(content) <= 50000),
  created_at timestamptz not null default now()
);

create index chat_messages_chat_created_idx on public.chat_messages (chat_id, created_at);

alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;

create policy "chats: read own" on public.chats
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "chats: insert own" on public.chats
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "chats: delete own" on public.chats
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "chat_messages: read own" on public.chat_messages
  for select to authenticated using ((select auth.uid()) = user_id);

-- Only into the user's own chats.
create policy "chat_messages: insert own" on public.chat_messages
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.chats c
      where c.id = chat_id and c.user_id = (select auth.uid())
    )
  );

revoke all on public.chats from anon;
revoke all on public.chat_messages from anon;
-- Chats change only through new messages (the trigger below); messages never change.
revoke update on public.chats from authenticated;
revoke update on public.chat_messages from authenticated;

create function public.touch_chat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chats
  set updated_at = greatest(updated_at, new.created_at)
  where id = new.chat_id;
  return new;
end;
$$;

create trigger chat_messages_touch_chat
  after insert on public.chat_messages
  for each row execute function public.touch_chat();
