create table if not exists public.app_activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (
    event_type in (
      'ACCOUNT_CREATED',
      'SIGNED_IN',
      'SIGNED_OUT',
      'SESSION_TIMEOUT',
      'PREDICTION_CREATED',
      'PREDICTION_UPDATED',
      'PREDICTION_DELETED',
      'PROFILE_UPDATED',
      'ONBOARDING_COMPLETED',
      'USER_DISABLED',
      'USER_ENABLED'
    )
  ),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and octet_length(metadata::text) <= 2048
  ),
  created_at timestamptz not null default now()
);

create index if not exists app_activity_logs_created_at_idx
  on public.app_activity_logs(created_at desc);

create index if not exists app_activity_logs_user_created_idx
  on public.app_activity_logs(user_id, created_at desc);

create index if not exists app_activity_logs_event_created_idx
  on public.app_activity_logs(event_type, created_at desc);

alter table public.app_activity_logs enable row level security;

revoke all on public.app_activity_logs from anon, authenticated;
grant select on public.app_activity_logs to authenticated;

drop policy if exists "Admins can read activity logs" on public.app_activity_logs;
create policy "Admins can read activity logs"
  on public.app_activity_logs
  for select
  to authenticated
  using (public.is_admin());

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
  if auth.uid() is null then
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

revoke all on function public.log_my_activity(text, jsonb) from public, anon;
grant execute on function public.log_my_activity(text, jsonb) to authenticated;

create or replace function public.audit_prediction_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_user_id uuid;
  activity_type text;
  activity_row public.predictions%rowtype;
begin
  if tg_op = 'UPDATE'
    and new.predicted_home_score is not distinct from old.predicted_home_score
    and new.predicted_away_score is not distinct from old.predicted_away_score then
    return null;
  end if;

  if tg_op = 'DELETE' then
    activity_row := old;
    activity_type := 'PREDICTION_DELETED';
  elsif tg_op = 'INSERT' then
    activity_row := new;
    activity_type := 'PREDICTION_CREATED';
  else
    activity_row := new;
    activity_type := 'PREDICTION_UPDATED';
  end if;

  activity_user_id := coalesce(auth.uid(), activity_row.user_id);

  insert into public.app_activity_logs (
    user_id,
    event_type,
    metadata
  )
  values (
    activity_user_id,
    activity_type,
    jsonb_build_object(
      'prediction_id', activity_row.id,
      'fixture_id', activity_row.fixture_id,
      'match_week', activity_row.match_week,
      'predicted_home_score', activity_row.predicted_home_score,
      'predicted_away_score', activity_row.predicted_away_score
    )
  );

  return null;
end;
$$;

drop trigger if exists audit_prediction_activity on public.predictions;
create trigger audit_prediction_activity
  after insert or update or delete on public.predictions
  for each row execute function public.audit_prediction_activity();

create or replace function public.audit_profile_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_fields text[] := array[]::text[];
begin
  if tg_op = 'INSERT' then
    insert into public.app_activity_logs (user_id, event_type)
    values (new.id, 'ACCOUNT_CREATED');
    return null;
  end if;

  if new.is_disabled is distinct from old.is_disabled then
    insert into public.app_activity_logs (
      user_id,
      target_user_id,
      event_type
    )
    values (
      auth.uid(),
      new.id,
      case when new.is_disabled then 'USER_DISABLED' else 'USER_ENABLED' end
    );
    return null;
  end if;

  if old.onboarding_required = true
    and new.onboarding_required = false then
    insert into public.app_activity_logs (user_id, event_type)
    values (new.id, 'ONBOARDING_COMPLETED');
    return null;
  end if;

  if new.username is distinct from old.username then
    changed_fields := array_append(changed_fields, 'username');
  end if;
  if new.first_name is distinct from old.first_name then
    changed_fields := array_append(changed_fields, 'first_name');
  end if;
  if new.last_name is distinct from old.last_name then
    changed_fields := array_append(changed_fields, 'last_name');
  end if;
  if new.favorite_club is distinct from old.favorite_club then
    changed_fields := array_append(changed_fields, 'favorite_club');
  end if;
  if new.avatar_url is distinct from old.avatar_url
    or new.avatar_path is distinct from old.avatar_path then
    changed_fields := array_append(changed_fields, 'avatar');
  end if;

  if cardinality(changed_fields) > 0 then
    insert into public.app_activity_logs (user_id, event_type, metadata)
    values (
      new.id,
      'PROFILE_UPDATED',
      jsonb_build_object('changed_fields', to_jsonb(changed_fields))
    );
  end if;

  return null;
end;
$$;

drop trigger if exists audit_profile_activity on public.profiles;
create trigger audit_profile_activity
  after insert or update on public.profiles
  for each row execute function public.audit_profile_activity();

create or replace function public.prune_activity_logs(retention_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if not public.is_admin() then
    raise exception 'Access denied';
  end if;

  if retention_days < 30 or retention_days > 365 then
    raise exception 'Retention must be between 30 and 365 days';
  end if;

  delete from public.app_activity_logs
  where created_at < now() - make_interval(days => retention_days);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.prune_activity_logs(integer) from public, anon;
grant execute on function public.prune_activity_logs(integer) to authenticated;
