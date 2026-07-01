-- DESTRUCTIVE EMERGENCY ROLLBACK
-- This permanently deletes every chat message and room. Disable
-- VITE_CHAT_ENABLED and redeploy the frontend before running this script.

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime drop table public.chat_messages;
  end if;
end;
$$;

revoke all on function public.prune_chat_messages() from public, anon, authenticated, service_role;
revoke all on function public.get_chat_display_names(uuid[]) from public, anon, authenticated, service_role;

drop function if exists public.prune_chat_messages();
drop function if exists public.get_chat_display_names(uuid[]);
drop table if exists public.chat_messages;
drop table if exists public.chat_rooms;
