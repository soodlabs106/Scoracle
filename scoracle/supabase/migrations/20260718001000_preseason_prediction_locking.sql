create or replace function public.get_fixture_match_week_lock_at(target_fixture_id uuid)
returns timestamptz
language sql
security definer
set search_path = public
stable
as $$
  select case
    when fixture.matchweek = 0
      then fixture.kickoff_utc - interval '1 hour'
    else (
      select min(peer.kickoff_utc) - interval '24 hours'
      from public.fixtures peer
      where peer.season = fixture.season
        and peer.matchweek = fixture.matchweek
    )
  end
  from public.fixtures fixture
  where fixture.id = target_fixture_id;
$$;
