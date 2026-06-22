create or replace function public.get_overall_leaderboard()
returns table (
  user_id uuid,
  username text,
  favorite_club text,
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
  group by p.user_id, pr.username, pr.favorite_club
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
  group by p.user_id, pr.username, pr.favorite_club, p.match_week
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

create or replace function public.get_scored_match_weeks()
returns table (match_week integer)
language sql
security definer
set search_path = public
stable
as $$
  select distinct p.match_week
  from public.predictions p
  where auth.uid() is not null
    and p.closeness is not null
    and p.closeness <> 'NOT_SCORED'
  order by p.match_week desc;
$$;

grant execute on function public.get_overall_leaderboard() to authenticated;
grant execute on function public.get_match_week_leaderboard(integer) to authenticated;
grant execute on function public.get_match_week_rank_movement(integer) to authenticated;
grant execute on function public.get_scored_match_weeks() to authenticated;
