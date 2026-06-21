create or replace function public.auth_email_exists(candidate_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select candidate_email is not null
    and length(trim(candidate_email)) > 0
    and exists (
      select 1
      from public.profiles
      where lower(email) = lower(trim(candidate_email))
    );
$$;

grant execute on function public.auth_email_exists(text) to anon, authenticated;
