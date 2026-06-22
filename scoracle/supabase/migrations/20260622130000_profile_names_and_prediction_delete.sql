alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  explicit_username text;
  requested_username text;
  requested_first_name text;
  requested_last_name text;
  violated_constraint text;
begin
  explicit_username := nullif(trim(new.raw_user_meta_data->>'username'), '');
  requested_first_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'first_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'given_name'), '')
  );
  requested_last_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'last_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'family_name'), '')
  );

  if explicit_username is not null then
    if exists (
      select 1
      from public.profiles
      where public.username_match_key(username) = public.username_match_key(explicit_username)
    ) then
      raise exception 'Username already exists'
        using errcode = '23505';
    end if;

    requested_username := explicit_username;
  else
    requested_username := nullif(trim(new.raw_user_meta_data->>'preferred_username'), '');

    if requested_username is null then
      requested_username := nullif(trim(new.raw_user_meta_data->>'name'), '');
    end if;

    if requested_username is null then
      requested_username := nullif(trim(new.raw_user_meta_data->>'full_name'), '');
    end if;

    if requested_username is null and new.email is not null then
      requested_username := split_part(new.email, '@', 1);
    end if;

    requested_username := public.unique_profile_username(requested_username);
  end if;

  insert into public.profiles (
    id,
    username,
    email,
    first_name,
    last_name,
    role,
    is_disabled
  )
  values (
    new.id,
    requested_username,
    coalesce(new.email, ''),
    requested_first_name,
    requested_last_name,
    'user',
    false
  );

  return new;
exception
  when unique_violation then
    get stacked diagnostics violated_constraint = constraint_name;

    if violated_constraint in (
      'profiles_username_key',
      'profiles_username_lower_idx',
      'profiles_username_match_key_idx'
    ) then
      raise exception 'Username already exists'
        using errcode = '23505';
    end if;

    raise;
end;
$$;

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

  if new.id is distinct from old.id
    or new.email is distinct from old.email
    or new.first_name is distinct from old.first_name
    or new.last_name is distinct from old.last_name
    or new.role is distinct from old.role
    or new.is_disabled is distinct from old.is_disabled
    or new.created_at is distinct from old.created_at then
    raise exception 'Only username, favorite club, and avatar can be updated';
  end if;

  return new;
end;
$$;

drop policy if exists "Users can delete their own unlocked predictions" on public.predictions;
create policy "Users can delete their own unlocked predictions"
  on public.predictions
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    and not public.is_fixture_match_week_locked(fixture_id)
  );
