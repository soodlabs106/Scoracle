begin;
select plan(5);

select has_table(
  'public',
  'system_job_runs',
  'system job run audit table exists'
);

select policies_are(
  'public',
  'system_job_runs',
  array['Admins can read system job runs'],
  'maintenance logs have only the admin read policy'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maintenance-user@test.local', '', now(), '{}', '{"username":"MaintenanceUser","first_name":"Maintenance","last_name":"User"}', now(), now()),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maintenance-admin@test.local', '', now(), '{}', '{"username":"MaintenanceAdmin","first_name":"Maintenance","last_name":"Admin"}', now(), now());

update public.profiles
set role = 'admin'
where id = '33333333-3333-4333-8333-333333333333';

insert into public.system_job_runs (job_name, status, details)
values (
  'github-daily-maintenance',
  'success',
  '{"source":"database_test"}'::jsonb
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);

select is(
  (select count(*)::integer from public.system_job_runs),
  0,
  'normal authenticated users cannot read maintenance logs'
);

select throws_ok(
  $$insert into public.system_job_runs (job_name, status)
    values ('browser-attempt', 'success')$$,
  '42501',
  null,
  'authenticated users cannot insert maintenance logs'
);

select set_config(
  'request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',
  true
);

select is(
  (select count(*)::integer from public.system_job_runs),
  1,
  'database admins can read maintenance logs'
);

select * from finish();
rollback;
