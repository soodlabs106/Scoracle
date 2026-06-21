create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text unique not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_disabled boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

create unique index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_disabled = false
  );
$$;

create or replace function public.is_username_available(candidate_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select candidate_username is not null
    and length(trim(candidate_username)) > 0
    and not exists (
      select 1
      from public.profiles
      where lower(username) = lower(trim(candidate_username))
    );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
begin
  requested_username := nullif(trim(new.raw_user_meta_data->>'username'), '');

  if requested_username is null then
    requested_username := 'user_' || replace(new.id::text, '-', '');
  end if;

  insert into public.profiles (id, username, email, role, is_disabled)
  values (
    new.id,
    requested_username,
    coalesce(new.email, ''),
    'user',
    false
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
    or current_setting('app.allow_profile_admin_update', true) = 'true' then
    return new;
  end if;

  if new.id <> old.id
    or new.email <> old.email
    or new.role <> old.role
    or new.is_disabled <> old.is_disabled
    or new.created_at <> old.created_at then
    raise exception 'Only username can be updated';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_privilege_escalation on public.profiles;
create trigger prevent_profile_privilege_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

create or replace function public.admin_set_user_disabled(
  target_user_id uuid,
  disabled boolean
)
returns table (
  id uuid,
  username text,
  role text,
  is_disabled boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Admins cannot disable themselves';
  end if;

  perform set_config('app.allow_profile_admin_update', 'true', true);

  return query
    update public.profiles p
    set is_disabled = disabled
    where p.id = target_user_id
    returning p.id, p.username, p.role, p.is_disabled, p.created_at;
end;
$$;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = id);

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Active users can update their username" on public.profiles;
create policy "Active users can update their username"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() is not null and auth.uid() = id and is_disabled = false)
  with check (auth.uid() is not null and auth.uid() = id and is_disabled = false);

drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles"
  on public.profiles
  for delete
  to authenticated
  using (public.is_admin() and id <> auth.uid());

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_username_available(text) to anon, authenticated;
grant execute on function public.admin_set_user_disabled(uuid, boolean) to authenticated;
