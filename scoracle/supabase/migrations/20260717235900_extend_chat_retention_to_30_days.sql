drop policy if exists "Active users can read retained chat messages"
  on public.chat_messages;

create policy "Active users can read retained chat messages"
  on public.chat_messages
  for select
  to authenticated
  using (
    public.is_active_user()
    and created_at >= now() - interval '30 days'
  );

create or replace function public.prune_chat_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.chat_messages
  where created_at < now() - interval '30 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.prune_chat_messages() from public, anon, authenticated;
grant execute on function public.prune_chat_messages() to service_role;
