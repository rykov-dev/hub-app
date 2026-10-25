-- Lets the client end the continuous session right away when the user leaves
-- the tab, instead of waiting for the heartbeat gap to expire.
create function public.end_activity_session(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.activity_sessions where user_id = p_user_id;
$$;

revoke execute on function public.end_activity_session(uuid) from public, anon, authenticated;
grant execute on function public.end_activity_session(uuid) to service_role;
