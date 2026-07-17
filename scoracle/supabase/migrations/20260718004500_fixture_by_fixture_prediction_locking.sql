create or replace function public.get_fixture_match_week_lock_at(target_fixture_id uuid)
returns timestamptz
language sql
security definer
set search_path = public
stable
as $$
  select fixture.kickoff_utc - interval '1 hour'
  from public.fixtures fixture
  where fixture.id = target_fixture_id;
$$;
