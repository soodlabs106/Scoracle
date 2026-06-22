alter table public.profiles
  add column if not exists favorite_club text;

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  match_week integer not null,
  predicted_home_score integer not null check (predicted_home_score between 0 and 99),
  predicted_away_score integer not null check (predicted_away_score between 0 and 99),
  closeness text check (
    closeness in ('EXACT', 'GREAT', 'CLOSE', 'NEAR_MISS', 'MISS', 'NOT_SCORED')
  ),
  points integer not null default 0,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fixture_id)
);

create index if not exists predictions_user_match_week_idx
  on public.predictions(user_id, match_week);

create index if not exists predictions_fixture_idx
  on public.predictions(fixture_id);

alter table public.predictions enable row level security;

create or replace function public.get_match_result(home_score integer, away_score integer)
returns text
language sql
immutable
as $$
  select case
    when home_score > away_score then 'HOME_WIN'
    when home_score = away_score then 'DRAW'
    else 'AWAY_WIN'
  end;
$$;

create or replace function public.get_prediction_closeness(
  predicted_home integer,
  predicted_away integer,
  actual_home integer,
  actual_away integer
)
returns text
language sql
immutable
as $$
  select case
    when actual_home is null or actual_away is null then 'NOT_SCORED'
    when predicted_home = actual_home and predicted_away = actual_away then 'EXACT'
    when public.get_match_result(predicted_home, predicted_away) = public.get_match_result(actual_home, actual_away)
      and (predicted_home - predicted_away) = (actual_home - actual_away) then 'GREAT'
    when public.get_match_result(predicted_home, predicted_away) = public.get_match_result(actual_home, actual_away) then 'CLOSE'
    when abs(predicted_home - actual_home) + abs(predicted_away - actual_away) <= 1 then 'NEAR_MISS'
    else 'MISS'
  end;
$$;

create or replace function public.get_prediction_points(closeness text)
returns integer
language sql
immutable
as $$
  select case closeness
    when 'EXACT' then 5
    when 'GREAT' then 3
    when 'CLOSE' then 2
    else 0
  end;
$$;

create or replace function public.get_fixture_match_week_lock_at(target_fixture_id uuid)
returns timestamptz
language sql
security definer
set search_path = public
stable
as $$
  select min(peer.kickoff_utc) - interval '24 hours'
  from public.fixtures fixture
  join public.fixtures peer
    on peer.season = fixture.season
   and peer.matchweek = fixture.matchweek
  where fixture.id = target_fixture_id;
$$;

create or replace function public.is_fixture_match_week_locked(target_fixture_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(now() >= public.get_fixture_match_week_lock_at(target_fixture_id), true);
$$;

create or replace function public.prepare_prediction_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fixture_match_week integer;
  actual_home integer;
  actual_away integer;
  computed_closeness text;
  allow_admin_update boolean;
begin
  allow_admin_update :=
    current_setting('app.allow_prediction_admin_update', true) = 'true';

  select matchweek, home_score, away_score
    into fixture_match_week, actual_home, actual_away
  from public.fixtures
  where id = new.fixture_id;

  if fixture_match_week is null then
    raise exception 'Fixture not found';
  end if;

  if public.is_fixture_match_week_locked(new.fixture_id) and not allow_admin_update then
    raise exception 'Predictions locked';
  end if;

  new.match_week := fixture_match_week;
  new.is_locked := public.is_fixture_match_week_locked(new.fixture_id);
  computed_closeness := public.get_prediction_closeness(
    new.predicted_home_score,
    new.predicted_away_score,
    actual_home,
    actual_away
  );
  new.closeness := computed_closeness;
  new.points := public.get_prediction_points(computed_closeness);
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists prepare_prediction_row on public.predictions;
create trigger prepare_prediction_row
  before insert or update on public.predictions
  for each row execute function public.prepare_prediction_row();

create or replace function public.score_my_predictions_for_completed_fixtures()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

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
    and prediction.user_id = auth.uid()
    and fixture.home_score is not null
    and fixture.away_score is not null;
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

  if new.id <> old.id
    or new.email <> old.email
    or new.role <> old.role
    or new.is_disabled <> old.is_disabled
    or new.created_at <> old.created_at then
    raise exception 'Only username and favorite club can be updated';
  end if;

  return new;
end;
$$;

drop policy if exists "Authenticated users can read teams" on public.teams;
create policy "Authenticated users can read teams"
  on public.teams
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read fixtures" on public.fixtures;
create policy "Authenticated users can read fixtures"
  on public.fixtures
  for select
  to authenticated
  using (true);

drop policy if exists "Users can read their own predictions" on public.predictions;
create policy "Users can read their own predictions"
  on public.predictions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Admins can read all predictions" on public.predictions;
create policy "Admins can read all predictions"
  on public.predictions
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Users can insert their own unlocked predictions" on public.predictions;
create policy "Users can insert their own unlocked predictions"
  on public.predictions
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_fixture_match_week_locked(fixture_id)
  );

drop policy if exists "Users can update their own unlocked predictions" on public.predictions;
create policy "Users can update their own unlocked predictions"
  on public.predictions
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and not public.is_fixture_match_week_locked(fixture_id)
  )
  with check (
    auth.uid() = user_id
    and not public.is_fixture_match_week_locked(fixture_id)
  );

grant execute on function public.get_match_result(integer, integer) to authenticated;
grant execute on function public.get_prediction_closeness(integer, integer, integer, integer) to authenticated;
grant execute on function public.get_prediction_points(text) to authenticated;
grant execute on function public.get_fixture_match_week_lock_at(uuid) to authenticated;
grant execute on function public.is_fixture_match_week_locked(uuid) to authenticated;
grant execute on function public.score_my_predictions_for_completed_fixtures() to authenticated;
