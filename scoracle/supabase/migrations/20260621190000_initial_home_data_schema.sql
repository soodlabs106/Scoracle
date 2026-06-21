create extension if not exists pgcrypto;

create table if not exists public.provider_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  sync_type text not null,
  status text not null check (status in ('started', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_text text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  short_name text not null,
  pulse_team_id text unique,
  thesportsdb_team_id text,
  api_football_team_id text,
  crest_url text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  pulse_player_id text unique,
  thesportsdb_player_id text,
  api_football_player_id text,
  current_team_id uuid references public.teams(id) on delete set null,
  photo_url text,
  photo_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.source_mappings (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('team', 'player', 'fixture')),
  entity_id uuid not null,
  provider text not null,
  provider_entity_id text not null,
  confidence numeric(4, 3) not null default 1.0,
  created_at timestamptz not null default now(),
  unique (entity_type, provider, provider_entity_id)
);

create table if not exists public.standings_snapshots (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  provider text not null,
  provider_sync_run_id uuid references public.provider_sync_runs(id) on delete set null,
  team_id uuid not null references public.teams(id) on delete cascade,
  position integer not null,
  played integer not null default 0,
  won integer not null default 0,
  drawn integer not null default 0,
  lost integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  goal_difference integer not null default 0,
  points integer not null default 0,
  form text,
  captured_at timestamptz not null default now(),
  unique (season, provider, team_id, captured_at)
);

create table if not exists public.fixtures (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  provider text not null,
  provider_fixture_id text not null,
  matchweek integer not null,
  kickoff_utc timestamptz not null,
  status text not null,
  venue text,
  home_team_id uuid not null references public.teams(id) on delete restrict,
  away_team_id uuid not null references public.teams(id) on delete restrict,
  home_score integer,
  away_score integer,
  scorers jsonb not null default '[]'::jsonb,
  assists jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_fixture_id)
);

create table if not exists public.player_leaders (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  category text not null check (category in ('goals', 'assists', 'clean_sheets')),
  provider text not null,
  player_id uuid references public.players(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  rank integer,
  value integer not null default 0,
  source text not null,
  verified boolean not null default true,
  captured_at timestamptz not null default now()
);

create table if not exists public.home_data_cache (
  request_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists provider_sync_runs_provider_type_idx
  on public.provider_sync_runs(provider, sync_type, started_at desc);

create index if not exists standings_snapshots_season_position_idx
  on public.standings_snapshots(season, position);

create index if not exists fixtures_season_kickoff_idx
  on public.fixtures(season, kickoff_utc);

create index if not exists fixtures_matchweek_idx
  on public.fixtures(season, matchweek);

create index if not exists player_leaders_category_rank_idx
  on public.player_leaders(season, category, rank);

create index if not exists home_data_cache_expires_at_idx
  on public.home_data_cache(expires_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_teams_updated_at on public.teams;
create trigger set_teams_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

drop trigger if exists set_players_updated_at on public.players;
create trigger set_players_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

drop trigger if exists set_fixtures_updated_at on public.fixtures;
create trigger set_fixtures_updated_at
  before update on public.fixtures
  for each row execute function public.set_updated_at();

alter table public.provider_sync_runs enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.source_mappings enable row level security;
alter table public.standings_snapshots enable row level security;
alter table public.fixtures enable row level security;
alter table public.player_leaders enable row level security;
alter table public.home_data_cache enable row level security;
