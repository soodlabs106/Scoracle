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
      where lower(username) = lower(explicit_username)
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

    if violated_constraint in ('profiles_username_key', 'profiles_username_lower_idx') then
      raise exception 'Username already exists'
        using errcode = '23505';
    end if;

    raise;
end;
$$;
