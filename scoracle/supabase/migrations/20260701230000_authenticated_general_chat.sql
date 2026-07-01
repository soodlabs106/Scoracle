create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  room_type text not null check (room_type in ('general', 'fixture')),
  fixture_id uuid references public.fixtures(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint chat_rooms_fixture_scope_check check (
    (room_type = 'general' and fixture_id is null)
    or (room_type = 'fixture' and fixture_id is not null)
  )
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  constraint chat_messages_length_check check (
    char_length(btrim(message)) between 1 and 500
  )
);

create unique index if not exists chat_rooms_one_general_idx
  on public.chat_rooms (room_type)
  where room_type = 'general';

create unique index if not exists chat_rooms_fixture_id_idx
  on public.chat_rooms (fixture_id)
  where fixture_id is not null;

create index if not exists chat_rooms_room_type_idx
  on public.chat_rooms (room_type);

create index if not exists chat_messages_room_created_at_idx
  on public.chat_messages (room_id, created_at desc);

insert into public.chat_rooms (id, name, room_type, fixture_id)
values ('00000000-0000-4000-8000-000000000001', 'General Chat', 'general', null)
on conflict (id) do update
set name = excluded.name,
    room_type = excluded.room_type,
    fixture_id = excluded.fixture_id;

alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;

revoke all on table public.chat_rooms from public, anon, authenticated;
revoke all on table public.chat_messages from public, anon, authenticated;
grant select on table public.chat_rooms to authenticated;
grant select, delete on table public.chat_messages to authenticated;
grant insert (room_id, user_id, message) on table public.chat_messages to authenticated;
grant all privileges on table public.chat_rooms, public.chat_messages to service_role;

create policy "Active users can read chat rooms"
  on public.chat_rooms
  for select
  to authenticated
  using (public.is_active_user());

create policy "Active users can read retained chat messages"
  on public.chat_messages
  for select
  to authenticated
  using (
    public.is_active_user()
    and created_at >= now() - interval '14 days'
  );

create policy "Active users can send their own chat messages"
  on public.chat_messages
  for insert
  to authenticated
  with check (
    public.is_active_user()
    and auth.uid() = user_id
    and created_at >= now() - interval '1 minute'
    and created_at <= now() + interval '1 minute'
  );

create policy "Admins can delete chat messages"
  on public.chat_messages
  for delete
  to authenticated
  using (public.is_admin());

create or replace function public.get_chat_display_names(user_ids uuid[])
returns table (
  user_id uuid,
  display_name text
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_active_user() then
    raise exception 'Authentication required';
  end if;

  if coalesce(cardinality(user_ids), 0) > 50 then
    raise exception 'Too many users requested';
  end if;

  return query
    select profile.id, coalesce(nullif(btrim(profile.username), ''), 'User')
    from public.profiles profile
    where profile.id = any(coalesce(user_ids, array[]::uuid[]))
      and profile.is_disabled = false;
end;
$$;

revoke all on function public.get_chat_display_names(uuid[]) from public, anon;
grant execute on function public.get_chat_display_names(uuid[]) to authenticated;

-- Scoracle retains chat content for no longer than 14 days. This function is
-- called once daily by the existing service-role maintenance workflow.
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
  where created_at < now() - interval '14 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.prune_chat_messages() from public, anon, authenticated;
grant execute on function public.prune_chat_messages() to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'chat_messages'
    ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end;
$$;

