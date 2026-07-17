revoke execute on function public.is_username_available(text) from anon;
grant execute on function public.is_username_available(text) to authenticated;

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
    null,
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

create or replace function public.is_safe_profile_avatar_url(
  owner_user_id uuid,
  candidate_avatar_url text,
  candidate_avatar_path text
)
returns boolean
language plpgsql
immutable
as $$
declare
  normalized_url text := nullif(trim(candidate_avatar_url), '');
  normalized_path text := nullif(trim(candidate_avatar_path), '');
  allowed_prefix text;
  allowed_prefixes text[] := array[
    'https://zweaobtyawuymvsyzeph.supabase.co/storage/v1/object/public/profile-avatars/',
    'http://127.0.0.1:54321/storage/v1/object/public/profile-avatars/',
    'http://localhost:54321/storage/v1/object/public/profile-avatars/'
  ];
begin
  if normalized_path is null then
    return normalized_url is null;
  end if;

  if owner_user_id is null or split_part(normalized_path, '/', 1) <> owner_user_id::text then
    return false;
  end if;

  if normalized_url is null then
    return false;
  end if;

  foreach allowed_prefix in array allowed_prefixes loop
    if normalized_url = allowed_prefix || normalized_path then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

create or replace function public.profile_avatar_public_url(
  candidate_avatar_path text,
  candidate_avatar_url text default null
)
returns text
language plpgsql
immutable
as $$
declare
  normalized_url text := nullif(trim(candidate_avatar_url), '');
  normalized_path text := nullif(trim(candidate_avatar_path), '');
  allowed_prefix text;
  allowed_prefixes text[] := array[
    'https://zweaobtyawuymvsyzeph.supabase.co/storage/v1/object/public/profile-avatars/',
    'http://127.0.0.1:54321/storage/v1/object/public/profile-avatars/',
    'http://localhost:54321/storage/v1/object/public/profile-avatars/'
  ];
begin
  if normalized_path is null then
    return null;
  end if;

  foreach allowed_prefix in array allowed_prefixes loop
    if normalized_url = allowed_prefix || normalized_path then
      return normalized_url;
    end if;
  end loop;

  return 'https://zweaobtyawuymvsyzeph.supabase.co/storage/v1/object/public/profile-avatars/' || normalized_path;
end;
$$;

create or replace function public.validate_profile_avatar_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.avatar_path := nullif(trim(new.avatar_path), '');
  new.avatar_url := nullif(trim(new.avatar_url), '');

  if new.avatar_path is null then
    new.avatar_url := null;
    return new;
  end if;

  if split_part(new.avatar_path, '/', 1) <> new.id::text then
    raise exception 'Avatar path must belong to the profile owner';
  end if;

  if new.avatar_url is not null
    and not public.is_safe_profile_avatar_url(new.id, new.avatar_url, new.avatar_path) then
    raise exception 'Avatar URL must reference the controlled profile avatar bucket';
  end if;

  new.avatar_url := public.profile_avatar_public_url(new.avatar_path, new.avatar_url);
  return new;
end;
$$;

drop trigger if exists validate_profile_avatar_fields on public.profiles;
create trigger validate_profile_avatar_fields
  before insert or update on public.profiles
  for each row execute function public.validate_profile_avatar_fields();

update public.profiles
set
  avatar_url = null,
  avatar_path = null
where not public.is_safe_profile_avatar_url(id, avatar_url, avatar_path);

create or replace function public.audit_profile_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_fields text[] := array[]::text[];
begin
  if tg_op = 'INSERT' then
    insert into public.app_activity_logs (user_id, event_type)
    values (new.id, 'ACCOUNT_CREATED');
    return null;
  end if;

  if new.is_disabled is distinct from old.is_disabled then
    if auth.uid() is not null then
      insert into public.app_activity_logs (
        user_id,
        target_user_id,
        event_type
      )
      values (
        auth.uid(),
        new.id,
        case when new.is_disabled then 'USER_DISABLED' else 'USER_ENABLED' end
      );
    end if;

    return null;
  end if;

  if old.onboarding_required = true
    and new.onboarding_required = false then
    insert into public.app_activity_logs (user_id, event_type)
    values (new.id, 'ONBOARDING_COMPLETED');
    return null;
  end if;

  if new.username is distinct from old.username then
    changed_fields := array_append(changed_fields, 'username');
  end if;
  if new.first_name is distinct from old.first_name then
    changed_fields := array_append(changed_fields, 'first_name');
  end if;
  if new.last_name is distinct from old.last_name then
    changed_fields := array_append(changed_fields, 'last_name');
  end if;
  if new.favorite_club is distinct from old.favorite_club then
    changed_fields := array_append(changed_fields, 'favorite_club');
  end if;
  if new.avatar_url is distinct from old.avatar_url
    or new.avatar_path is distinct from old.avatar_path then
    changed_fields := array_append(changed_fields, 'avatar');
  end if;

  if cardinality(changed_fields) > 0 then
    insert into public.app_activity_logs (user_id, event_type, metadata)
    values (
      new.id,
      'PROFILE_UPDATED',
      jsonb_build_object('changed_fields', to_jsonb(changed_fields))
    );
  end if;

  return null;
end;
$$;
