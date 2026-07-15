create or replace function public.is_username_available(candidate_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select candidate_username is not null
    and length(trim(candidate_username)) > 0
    and public.username_match_key(candidate_username) <> ''
    and not exists (
      select 1
      from public.profiles
      where public.username_match_key(username) = public.username_match_key(candidate_username)
        and (auth.uid() is null or id <> auth.uid())
    );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  explicit_username text;
  requested_username text;
  requested_first_name text;
  requested_last_name text;
  requested_avatar_url text;
  violated_constraint text;
begin
  explicit_username := nullif(trim(new.raw_user_meta_data->>'username'), '');
  requested_first_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'first_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'given_name'), '')
  );
  requested_last_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'last_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'family_name'), '')
  );
  requested_avatar_url := coalesce(
    nullif(trim(new.raw_user_meta_data->>'avatar_url'), ''),
    nullif(trim(new.raw_user_meta_data->>'picture'), '')
  );

  if explicit_username is not null then
    if exists (
      select 1
      from public.profiles
      where public.username_match_key(username) = public.username_match_key(explicit_username)
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

  insert into public.profiles (
    id,
    username,
    email,
    first_name,
    last_name,
    avatar_url,
    avatar_path,
    role,
    is_disabled,
    onboarding_required,
    onboarding_completed_at
  )
  values (
    new.id,
    requested_username,
    coalesce(new.email, ''),
    requested_first_name,
    requested_last_name,
    requested_avatar_url,
    null,
    'user',
    false,
    true,
    null
  );

  return new;
exception
  when unique_violation then
    get stacked diagnostics violated_constraint = constraint_name;

    if violated_constraint in (
      'profiles_username_key',
      'profiles_username_lower_idx',
      'profiles_username_match_key_idx'
    ) then
      raise exception 'Username already exists'
        using errcode = '23505';
    end if;

    raise;
end;
$$;

create or replace function public.get_overall_leaderboard()
returns table (
  user_id uuid,
  username text,
  favorite_club text,
  avatar_url text,
  total_points bigint,
  scored_predictions bigint,
  exact_count bigint,
  great_count bigint,
  close_count bigint,
  near_miss_count bigint,
  miss_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.user_id,
    pr.username,
    pr.favorite_club,
    pr.avatar_url,
    coalesce(sum(p.points), 0)::bigint as total_points,
    count(*) filter (
      where p.closeness is not null and p.closeness <> 'NOT_SCORED'
    )::bigint as scored_predictions,
    count(*) filter (where p.closeness = 'EXACT')::bigint as exact_count,
    count(*) filter (where p.closeness = 'GREAT')::bigint as great_count,
    count(*) filter (where p.closeness = 'CLOSE')::bigint as close_count,
    count(*) filter (where p.closeness = 'NEAR_MISS')::bigint as near_miss_count,
    count(*) filter (where p.closeness = 'MISS')::bigint as miss_count
  from public.predictions p
  join public.profiles pr on pr.id = p.user_id
  where auth.uid() is not null
    and p.closeness is not null
    and p.closeness <> 'NOT_SCORED'
  group by p.user_id, pr.username, pr.favorite_club, pr.avatar_url
  order by
    total_points desc,
    exact_count desc,
    great_count desc,
    close_count desc,
    scored_predictions asc,
    username asc;
$$;

create or replace function public.get_match_week_leaderboard(selected_match_week integer)
returns table (
  user_id uuid,
  username text,
  favorite_club text,
  avatar_url text,
  match_week integer,
  total_points bigint,
  scored_predictions bigint,
  exact_count bigint,
  great_count bigint,
  close_count bigint,
  near_miss_count bigint,
  miss_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.user_id,
    pr.username,
    pr.favorite_club,
    pr.avatar_url,
    p.match_week,
    coalesce(sum(p.points), 0)::bigint as total_points,
    count(*) filter (
      where p.closeness is not null and p.closeness <> 'NOT_SCORED'
    )::bigint as scored_predictions,
    count(*) filter (where p.closeness = 'EXACT')::bigint as exact_count,
    count(*) filter (where p.closeness = 'GREAT')::bigint as great_count,
    count(*) filter (where p.closeness = 'CLOSE')::bigint as close_count,
    count(*) filter (where p.closeness = 'NEAR_MISS')::bigint as near_miss_count,
    count(*) filter (where p.closeness = 'MISS')::bigint as miss_count
  from public.predictions p
  join public.profiles pr on pr.id = p.user_id
  where auth.uid() is not null
    and p.match_week = selected_match_week
    and p.closeness is not null
    and p.closeness <> 'NOT_SCORED'
  group by p.user_id, pr.username, pr.favorite_club, pr.avatar_url, p.match_week
  order by
    total_points desc,
    exact_count desc,
    great_count desc,
    close_count desc,
    scored_predictions asc,
    username asc;
$$;

create or replace function public.get_match_week_rank_movement(selected_match_week integer)
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
  with scored_predictions as (
    select
      p.user_id,
      p.match_week,
      p.points,
      p.closeness
    from public.predictions p
    where auth.uid() is not null
      and p.closeness is not null
      and p.closeness <> 'NOT_SCORED'
      and p.match_week <= selected_match_week
  ),
  weekly_points as (
    select
      sp.user_id,
      sp.match_week,
      coalesce(sum(sp.points), 0)::bigint as points,
      count(*) filter (where sp.closeness = 'EXACT')::bigint as exact_count,
      count(*) filter (where sp.closeness = 'GREAT')::bigint as great_count,
      count(*) filter (where sp.closeness = 'CLOSE')::bigint as close_count
    from scored_predictions sp
    group by sp.user_id, sp.match_week
  ),
  cumulative_current as (
    select
      wp.user_id,
      coalesce(sum(wp.points), 0)::bigint as total_points,
      coalesce(sum(wp.exact_count), 0)::bigint as exact_count,
      coalesce(sum(wp.great_count), 0)::bigint as great_count,
      coalesce(sum(wp.close_count), 0)::bigint as close_count
    from weekly_points wp
    where wp.match_week <= selected_match_week
    group by wp.user_id
  ),
  cumulative_previous as (
    select
      wp.user_id,
      coalesce(sum(wp.points), 0)::bigint as total_points,
      coalesce(sum(wp.exact_count), 0)::bigint as exact_count,
      coalesce(sum(wp.great_count), 0)::bigint as great_count,
      coalesce(sum(wp.close_count), 0)::bigint as close_count
    from weekly_points wp
    where wp.match_week < selected_match_week
    group by wp.user_id
  ),
  current_ranked as (
    select
      cc.user_id,
      rank() over (
        order by
          cc.total_points desc,
          cc.exact_count desc,
          cc.great_count desc,
          cc.close_count desc
      ) as current_rank,
      cc.total_points,
      cc.exact_count,
      cc.great_count,
      cc.close_count
    from cumulative_current cc
  ),
  previous_ranked as (
    select
      cp.user_id,
      rank() over (
        order by
          cp.total_points desc,
          cp.exact_count desc,
          cp.great_count desc,
          cp.close_count desc
      ) as previous_rank
    from cumulative_previous cp
  ),
  selected_week_points as (
    select
      sp.user_id,
      coalesce(sum(sp.points), 0)::bigint as weekly_points
    from scored_predictions sp
    where sp.match_week = selected_match_week
    group by sp.user_id
  )
  select
    cr.user_id,
    pr.username,
    pr.favorite_club,
    pr.avatar_url,
    selected_match_week as match_week,
    cr.current_rank,
    prev.previous_rank,
    case
      when prev.previous_rank is null then null
      else prev.previous_rank - cr.current_rank
    end as rank_change,
    coalesce(swp.weekly_points, 0)::bigint as weekly_points,
    cr.total_points as overall_points_after_week,
    cr.exact_count,
    cr.great_count,
    cr.close_count
  from current_ranked cr
  join public.profiles pr on pr.id = cr.user_id
  left join previous_ranked prev on prev.user_id = cr.user_id
  left join selected_week_points swp on swp.user_id = cr.user_id
  order by
    cr.current_rank asc,
    pr.username asc;
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
