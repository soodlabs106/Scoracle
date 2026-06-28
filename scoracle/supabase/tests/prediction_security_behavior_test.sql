begin;
select plan(8);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'active@test.local', '', now(), '{}', '{"username":"ActiveUser","first_name":"Active","last_name":"User"}', now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'disabled@test.local', '', now(), '{}', '{"username":"DisabledUser","first_name":"Disabled","last_name":"User"}', now(), now()),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local', '', now(), '{}', '{"username":"AdminUser","first_name":"Admin","last_name":"User"}', now(), now());

update public.profiles set is_disabled = true
where id = '22222222-2222-4222-8222-222222222222';
update public.profiles set role = 'admin'
where id = '33333333-3333-4333-8333-333333333333';

insert into public.teams (id, canonical_name, short_name, pulse_team_id, team_code)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Home Club', 'Home', 'test-home', 'HOM'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Away Club', 'Away', 'test-away', 'AWY');

insert into public.fixtures (
  id, season, provider, provider_fixture_id, matchweek, kickoff_utc,
  status, home_team_id, away_team_id
)
values
  ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'test', 'test', 'future', 1, now() + interval '7 days', 'scheduled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  ('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', 'test', 'test', 'locked', 2, now() + interval '12 hours', 'scheduled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select ok(public.is_active_user(), 'active profile is recognized');
select lives_ok(
  $$insert into public.predictions (user_id, fixture_id, match_week, predicted_home_score, predicted_away_score)
    values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 99, 2, 1)$$,
  'active user can insert an unlocked prediction'
);
select is(
  (select match_week from public.predictions where user_id = auth.uid()),
  1,
  'database derives match week from the fixture'
);
select throws_ok(
  $$insert into public.predictions (user_id, fixture_id, match_week, predicted_home_score, predicted_away_score)
    values ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', 2, 1, 1)$$,
  '42501',
  null,
  'database rejects predictions inside the 24-hour match-week lock'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.fixtures
set home_score = 2, away_score = 1, status = 'completed'
where id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';

select is(
  (select closeness || ':' || points::text from public.predictions where user_id = '11111111-1111-4111-8111-111111111111'),
  'EXACT:5',
  'fixture result trigger scores all matching predictions'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select ok(not public.is_active_user(), 'disabled profile is not active');
select throws_ok(
  $$insert into public.predictions (user_id, fixture_id, match_week, predicted_home_score, predicted_away_score)
    values ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 1, 0, 0)$$,
  '42501',
  null,
  'disabled user cannot insert a prediction'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('app.allow_prediction_admin_update', 'true', true);
insert into public.predictions (user_id, fixture_id, match_week, predicted_home_score, predicted_away_score)
values ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 1, 0, 0);

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select is((select count(*)::integer from public.predictions), 2, 'admin can read all predictions');

select * from finish();
rollback;
