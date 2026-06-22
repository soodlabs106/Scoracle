alter table public.teams
  add column if not exists team_code text;

update public.teams
set team_code = case
  when pulse_team_id = '1' or lower(canonical_name) = 'arsenal' then 'ARS'
  when pulse_team_id = '2' or lower(canonical_name) = 'aston villa' then 'AVL'
  when pulse_team_id = '127' or lower(canonical_name) = 'bournemouth' then 'BOU'
  when pulse_team_id = '130' or lower(canonical_name) = 'brentford' then 'BRE'
  when pulse_team_id = '131' or lower(canonical_name) = 'brighton & hove albion' then 'BRI'
  when pulse_team_id = '4' or lower(canonical_name) = 'chelsea' then 'CHE'
  when pulse_team_id = '5' or lower(canonical_name) = 'coventry city' then 'COV'
  when pulse_team_id = '6' or lower(canonical_name) = 'crystal palace' then 'CRY'
  when pulse_team_id = '7' or lower(canonical_name) = 'everton' then 'EVE'
  when pulse_team_id = '34' or lower(canonical_name) = 'fulham' then 'FUL'
  when pulse_team_id = '41' or lower(canonical_name) = 'hull city' then 'HUL'
  when pulse_team_id = '8' or lower(canonical_name) = 'ipswich town' then 'IPS'
  when pulse_team_id = '9' or lower(canonical_name) = 'leeds united' then 'LEE'
  when pulse_team_id = '10' or lower(canonical_name) = 'liverpool' then 'LIV'
  when pulse_team_id = '11' or lower(canonical_name) = 'manchester city' then 'MCI'
  when pulse_team_id = '12' or lower(canonical_name) = 'manchester united' then 'MUN'
  when pulse_team_id = '23' or lower(canonical_name) = 'newcastle united' then 'NEW'
  when pulse_team_id = '15' or lower(canonical_name) = 'nottingham forest' then 'NFO'
  when pulse_team_id = '29' or lower(canonical_name) = 'sunderland' then 'SUN'
  when pulse_team_id = '21' or lower(canonical_name) = 'tottenham hotspur' then 'TOT'
  else upper(left(regexp_replace(coalesce(short_name, canonical_name), '[^[:alnum:]]', '', 'g'), 3))
end
where team_code is null or length(team_code) = 0;

alter table public.teams
  alter column team_code set default 'TBC';

alter table public.teams
  drop constraint if exists teams_team_code_format_check;

alter table public.teams
  add constraint teams_team_code_format_check
  check (team_code is null or team_code ~ '^[A-Z0-9]{2,3}$');
