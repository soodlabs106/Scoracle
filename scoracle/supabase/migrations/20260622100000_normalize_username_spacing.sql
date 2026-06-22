create or replace function public.username_match_key(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(coalesce(value, '')), '[[:space:]]+', '', 'g');
$$;

create unique index if not exists profiles_username_match_key_idx
  on public.profiles (public.username_match_key(username));

create or replace function public.is_username_available(candidate_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select candidate_username is not null
    and length(trim(candidate_username)) > 0
    and public.username_match_key(candidate_username) <> ''
    and not exists (
      select 1
      from public.profiles
      where public.username_match_key(username) = public.username_match_key(candidate_username)
        and (auth.uid() is null or id <> auth.uid())
    );
$$;

create or replace function public.unique_profile_username(base_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base_candidate text;
  candidate text;
  suffix integer := 0;
begin
  base_candidate := coalesce(
    nullif(public.slugify_username(base_username), ''),
    'scoracle_user'
  );
  candidate := base_candidate;

  while exists (
    select 1
    from public.profiles
    where public.username_match_key(username) = public.username_match_key(candidate)
  ) loop
    suffix := suffix + 1;
    candidate := base_candidate || '_' || suffix::text;
  end loop;

  return candidate;
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
  violated_constraint text;
begin
  explicit_username := nullif(trim(new.raw_user_meta_data->>'username'), '');

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

  insert into public.profiles (id, username, email, role, is_disabled)
  values (
    new.id,
    requested_username,
    coalesce(new.email, ''),
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

grant execute on function public.username_match_key(text) to anon, authenticated;
grant execute on function public.is_username_available(text) to anon, authenticated;
grant execute on function public.unique_profile_username(text) to authenticated;
