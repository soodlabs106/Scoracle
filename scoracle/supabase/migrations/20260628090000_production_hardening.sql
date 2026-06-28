create or replace function public.is_active_user()
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
      and is_disabled = false
  );
$$;

revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated;

-- Do not rely on legacy Supabase default privileges. Table grants permit an
-- operation class; row-level policies below still decide which rows are visible.
grant select, update, delete on table public.profiles to authenticated;
grant select on table public.teams, public.fixtures to authenticated;
grant select, insert, update, delete on table public.predictions to authenticated;
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

drop policy if exists "Users can read their own predictions" on public.predictions;
create policy "Active users can read their own predictions"
  on public.predictions
  for select
  to authenticated
  using (auth.uid() = user_id and public.is_active_user());

drop policy if exists "Users can insert their own unlocked predictions" on public.predictions;
create policy "Active users can insert their own unlocked predictions"
  on public.predictions
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_active_user()
    and not public.is_fixture_match_week_locked(fixture_id)
  );

drop policy if exists "Users can update their own unlocked predictions" on public.predictions;
create policy "Active users can update their own unlocked predictions"
  on public.predictions
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_active_user()
    and not public.is_fixture_match_week_locked(fixture_id)
  )
  with check (
    auth.uid() = user_id
    and public.is_active_user()
    and not public.is_fixture_match_week_locked(fixture_id)
  );

drop policy if exists "Users can delete their own unlocked predictions" on public.predictions;
create policy "Active users can delete their own unlocked predictions"
  on public.predictions
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_active_user()
    and not public.is_fixture_match_week_locked(fixture_id)
  );

drop policy if exists "Active users can update their username" on public.profiles;
create policy "Active users can update their profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id and public.is_active_user())
  with check (auth.uid() = id and public.is_active_user());

drop policy if exists "Users can upload their own profile avatar" on storage.objects;
create policy "Active users can upload their own profile avatar"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_user()
  );

drop policy if exists "Users can update their own profile avatar" on storage.objects;
create policy "Active users can update their own profile avatar"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_user()
  )
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_user()
  );

drop policy if exists "Users can delete their own profile avatar" on storage.objects;
create policy "Active users can delete their own profile avatar"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_user()
  );

create or replace function public.log_my_activity(
  activity_type text,
  activity_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Authentication required';
  end if;

  if activity_type not in ('SIGNED_IN', 'SIGNED_OUT', 'SESSION_TIMEOUT') then
    raise exception 'Unsupported activity type';
  end if;

  if activity_metadata is null
    or jsonb_typeof(activity_metadata) <> 'object'
    or octet_length(activity_metadata::text) > 2048 then
    raise exception 'Invalid activity metadata';
  end if;

  insert into public.app_activity_logs (user_id, event_type, metadata)
  values (auth.uid(), activity_type, activity_metadata);
end;
$$;

create or replace function public.score_predictions_for_fixture()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.home_score is null or new.away_score is null then
    return null;
  end if;

  if tg_op = 'UPDATE'
    and new.home_score is not distinct from old.home_score
    and new.away_score is not distinct from old.away_score then
    return null;
  end if;

  perform set_config('app.allow_prediction_admin_update', 'true', true);

  update public.predictions prediction
  set
    closeness = public.get_prediction_closeness(
      prediction.predicted_home_score,
      prediction.predicted_away_score,
      new.home_score,
      new.away_score
    ),
    points = public.get_prediction_points(
      public.get_prediction_closeness(
        prediction.predicted_home_score,
        prediction.predicted_away_score,
        new.home_score,
        new.away_score
      )
    ),
    is_locked = public.is_fixture_match_week_locked(new.id),
    updated_at = now()
  where prediction.fixture_id = new.id;

  return null;
end;
$$;

drop trigger if exists score_predictions_on_fixture_result on public.fixtures;
create trigger score_predictions_on_fixture_result
  after insert or update of home_score, away_score on public.fixtures
  for each row execute function public.score_predictions_for_fixture();

create or replace function public.score_all_completed_predictions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  scored_count integer;
begin
  perform set_config('app.allow_prediction_admin_update', 'true', true);

  update public.predictions prediction
  set
    closeness = public.get_prediction_closeness(
      prediction.predicted_home_score,
      prediction.predicted_away_score,
      fixture.home_score,
      fixture.away_score
    ),
    points = public.get_prediction_points(
      public.get_prediction_closeness(
        prediction.predicted_home_score,
        prediction.predicted_away_score,
        fixture.home_score,
        fixture.away_score
      )
    ),
    is_locked = public.is_fixture_match_week_locked(prediction.fixture_id),
    updated_at = now()
  from public.fixtures fixture
  where prediction.fixture_id = fixture.id
    and fixture.home_score is not null
    and fixture.away_score is not null;

  get diagnostics scored_count = row_count;
  return scored_count;
end;
$$;

revoke all on function public.score_all_completed_predictions() from public, anon, authenticated;

select public.score_all_completed_predictions();

create or replace function public.auth_email_exists(candidate_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select candidate_email is not null and length(trim(candidate_email)) > 0;
$$;

create or replace function public.get_rank_timeline()
returns table (
  user_id uuid,
  username text,
  favorite_club text,
  avatar_url text,
  match_week integer,
  current_rank bigint,
  previous_rank bigint,
  rank_change bigint,
  weekly_points bigint,
  overall_points_after_week bigint,
  exact_count bigint,
  great_count bigint,
  close_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with scored as (
    select p.user_id, p.match_week, p.points, p.closeness
    from public.predictions p
    where public.is_active_user()
      and p.closeness is not null
      and p.closeness <> 'NOT_SCORED'
  ),
  weeks as (
    select distinct match_week from scored
  ),
  users as (
    select distinct user_id from scored
  ),
  cumulative as (
    select
      users.user_id,
      weeks.match_week,
      coalesce(sum(scored.points) filter (where scored.match_week <= weeks.match_week), 0)::bigint as total_points,
      count(*) filter (where scored.match_week <= weeks.match_week and scored.closeness = 'EXACT')::bigint as exact_count,
      count(*) filter (where scored.match_week <= weeks.match_week and scored.closeness = 'GREAT')::bigint as great_count,
      count(*) filter (where scored.match_week <= weeks.match_week and scored.closeness = 'CLOSE')::bigint as close_count,
      coalesce(sum(scored.points) filter (where scored.match_week = weeks.match_week), 0)::bigint as weekly_points
    from users
    cross join weeks
    left join scored on scored.user_id = users.user_id
    group by users.user_id, weeks.match_week
  ),
  ranked as (
    select
      cumulative.*,
      rank() over (
        partition by match_week
        order by total_points desc, exact_count desc, great_count desc, close_count desc
      ) as current_rank
    from cumulative
  )
  select
    ranked.user_id,
    profile.username,
    profile.favorite_club,
    profile.avatar_url,
    ranked.match_week,
    ranked.current_rank,
    lag(ranked.current_rank) over (
      partition by ranked.user_id order by ranked.match_week
    ) as previous_rank,
    lag(ranked.current_rank) over (
      partition by ranked.user_id order by ranked.match_week
    ) - ranked.current_rank as rank_change,
    ranked.weekly_points,
    ranked.total_points as overall_points_after_week,
    ranked.exact_count,
    ranked.great_count,
    ranked.close_count
  from ranked
  join public.profiles profile on profile.id = ranked.user_id
  order by ranked.match_week, ranked.current_rank, profile.username;
$$;

grant execute on function public.get_rank_timeline() to authenticated;

create or replace function public.get_my_prediction_history()
returns table (
  prediction_id uuid,
  fixture_id uuid,
  match_week integer,
  predicted_home_score integer,
  predicted_away_score integer,
  closeness text,
  points integer,
  is_locked boolean,
  prediction_created_at timestamptz,
  prediction_updated_at timestamptz,
  kickoff_utc timestamptz,
  home_score integer,
  away_score integer,
  home_team_name text,
  away_team_name text,
  home_team_code text,
  away_team_code text,
  home_team_crest_url text,
  away_team_crest_url text,
  matchweek_lock_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    prediction.id,
    prediction.fixture_id,
    prediction.match_week,
    prediction.predicted_home_score,
    prediction.predicted_away_score,
    prediction.closeness,
    prediction.points,
    prediction.is_locked,
    prediction.created_at,
    prediction.updated_at,
    fixture.kickoff_utc,
    fixture.home_score,
    fixture.away_score,
    home_team.canonical_name,
    away_team.canonical_name,
    home_team.team_code,
    away_team.team_code,
    home_team.crest_url,
    away_team.crest_url,
    public.get_fixture_match_week_lock_at(prediction.fixture_id)
  from public.predictions prediction
  join public.fixtures fixture on fixture.id = prediction.fixture_id
  join public.teams home_team on home_team.id = fixture.home_team_id
  join public.teams away_team on away_team.id = fixture.away_team_id
  where prediction.user_id = auth.uid()
    and public.is_active_user()
  order by prediction.match_week desc, fixture.kickoff_utc asc;
$$;

revoke all on function public.get_my_prediction_history() from public, anon;
grant execute on function public.get_my_prediction_history() to authenticated;

create or replace function public.prune_operational_data(retention_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Access denied';
  end if;

  delete from public.app_activity_logs
  where created_at < now() - make_interval(days => greatest(30, least(retention_days, 365)));
  get diagnostics deleted_count = row_count;

  delete from public.home_data_cache where expires_at < now() - interval '7 days';
  return deleted_count;
end;
$$;

revoke all on function public.prune_operational_data(integer) from public, anon, authenticated;

create table if not exists public.provider_sync_leases (
  lease_key text primary key,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.provider_sync_leases enable row level security;
revoke all on public.provider_sync_leases from anon, authenticated;
grant all privileges on table public.provider_sync_leases to service_role;

create or replace function public.try_acquire_sync_lease(
  requested_lease_key text,
  lease_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  acquired_key text;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Access denied';
  end if;

  insert into public.provider_sync_leases (lease_key, expires_at, updated_at)
  values (
    requested_lease_key,
    now() + make_interval(secs => greatest(30, least(lease_seconds, 900))),
    now()
  )
  on conflict (lease_key) do update
  set expires_at = excluded.expires_at, updated_at = now()
  where public.provider_sync_leases.expires_at <= now()
  returning lease_key into acquired_key;

  return acquired_key is not null;
end;
$$;

create or replace function public.release_sync_lease(requested_lease_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Access denied';
  end if;

  delete from public.provider_sync_leases where lease_key = requested_lease_key;
end;
$$;

revoke all on function public.try_acquire_sync_lease(text, integer) from public, anon, authenticated;
revoke all on function public.release_sync_lease(text) from public, anon, authenticated;
grant execute on function public.try_acquire_sync_lease(text, integer) to service_role;
grant execute on function public.release_sync_lease(text) to service_role;

comment on table public.players is
  'Reserved for a future normalized provider sync; current squad data is cached in home_data_cache.';
comment on table public.source_mappings is
  'Reserved for future provider reconciliation; not used by the current application runtime.';
comment on table public.standings_snapshots is
  'Reserved for historical standings; current standings are served from the normalized home payload.';
comment on table public.player_leaders is
  'Reserved for historical leader snapshots; current leaders are served from the normalized home payload.';
