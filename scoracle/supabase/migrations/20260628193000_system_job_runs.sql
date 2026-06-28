create table if not exists public.system_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null check (status in ('success', 'failed', 'skipped')),
  details jsonb check (
    details is null
    or (
      jsonb_typeof(details) = 'object'
      and octet_length(details::text) <= 8192
    )
  ),
  ran_at timestamptz not null default now()
);

create index if not exists system_job_runs_ran_at_idx
  on public.system_job_runs (ran_at desc);

alter table public.system_job_runs enable row level security;

revoke all on table public.system_job_runs from public, anon, authenticated;
grant select on table public.system_job_runs to authenticated;
grant all privileges on table public.system_job_runs to service_role;

drop policy if exists "Admins can read system job runs" on public.system_job_runs;
create policy "Admins can read system job runs"
  on public.system_job_runs
  for select
  to authenticated
  using (public.is_admin());
