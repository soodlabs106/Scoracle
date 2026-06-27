alter table public.profiles
  add column if not exists onboarding_required boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz;

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
    or new.role is distinct from old.role
    or new.is_disabled is distinct from old.is_disabled
    or new.created_at is distinct from old.created_at then
    raise exception 'Only username, first name, last name, favorite club, avatar, and onboarding completion can be updated';
  end if;

  if old.onboarding_required = false and new.onboarding_required = true then
    raise exception 'Onboarding cannot be marked required by the user';
  end if;

  if old.onboarding_completed_at is not null
    and new.onboarding_completed_at is distinct from old.onboarding_completed_at then
    raise exception 'Onboarding completion timestamp cannot be changed';
  end if;

  if new.onboarding_completed_at is distinct from old.onboarding_completed_at
    and new.onboarding_required = true then
    raise exception 'Onboarding must be marked complete with its completion timestamp';
  end if;

  if old.onboarding_required = true
    and new.onboarding_required = false
    and new.onboarding_completed_at is null then
    raise exception 'Onboarding completion timestamp is required';
  end if;

  return new;
end;
$$;

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
  requested_avatar_url text;
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
  requested_avatar_url := coalesce(
    nullif(trim(new.raw_user_meta_data->>'avatar_url'), ''),
    nullif(trim(new.raw_user_meta_data->>'picture'), '')
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
    avatar_url,
    avatar_path,
    role,
    is_disabled,
    onboarding_required,
    onboarding_completed_at
  )
  values (
    new.id,
    requested_username,
    coalesce(new.email, ''),
    requested_first_name,
    requested_last_name,
    requested_avatar_url,
    null,
    'user',
    false,
    true,
    null
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
