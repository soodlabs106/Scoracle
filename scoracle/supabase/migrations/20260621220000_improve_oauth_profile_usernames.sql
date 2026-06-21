create or replace function public.slugify_username(value text)
returns text
language sql
immutable
as $$
  select trim(both '_' from lower(regexp_replace(coalesce(value, ''), '[^a-zA-Z0-9]+', '_', 'g')));
$$;

create or replace function public.unique_profile_username(base_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
  suffix integer := 0;
begin
  candidate := nullif(public.slugify_username(base_username), '');

  if candidate is null then
    candidate := 'scoracle_user';
  end if;

  while exists (
    select 1
    from public.profiles
    where lower(username) = lower(candidate)
  ) loop
    suffix := suffix + 1;
    candidate := public.slugify_username(base_username) || '_' || suffix::text;
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
  requested_username text;
begin
  requested_username := nullif(trim(new.raw_user_meta_data->>'username'), '');

  if requested_username is null then
    requested_username := nullif(trim(new.raw_user_meta_data->>'preferred_username'), '');
  end if;

  if requested_username is null then
    requested_username := nullif(trim(new.raw_user_meta_data->>'name'), '');
  end if;

  if requested_username is null then
    requested_username := nullif(trim(new.raw_user_meta_data->>'full_name'), '');
  end if;

  if requested_username is null and new.email is not null then
    requested_username := split_part(new.email, '@', 1);
  end if;

  insert into public.profiles (id, username, email, role, is_disabled)
  values (
    new.id,
    public.unique_profile_username(requested_username),
    coalesce(new.email, ''),
    'user',
    false
  );

  return new;
end;
$$;

grant execute on function public.slugify_username(text) to authenticated;
grant execute on function public.unique_profile_username(text) to authenticated;
