# Scoracle

Scoracle is a Premier League fixture and score-prediction application built with React, Vite, TypeScript, Netlify Functions, and Supabase.

## Architecture

- `src/app`: application composition, routing, query client, and global error boundary.
- `src/features`: feature-owned UI and client services for Help, home data, and predictions.
- `src/context`: authenticated session and profile lifecycle.
- `src/pages`: route containers for profile, leaderboard, admin, auth callback, and password reset.
- `src/data`: remaining typed client repositories and local development simulations.
- `shared/contracts`: Zod contracts shared by browser and Netlify code.
- `netlify/core`: HTTP policy, request IDs, logging, and server-only Supabase configuration.
- `netlify/functions`: thin API handlers and provider orchestration.
- `supabase/migrations`: schema, RLS, triggers, and aggregate RPCs in deployment order.
- `supabase/tests`: pgTAP database security and behavior checks.

The browser uses the Supabase anon key and is constrained by RLS. Provider synchronization, OAuth avatar downloads, and Auth administration use Netlify Functions with the service-role key. That key must never use a `VITE_` prefix.

## Local Development

```powershell
npm install
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Copy `.env.example` to `.env.local` and provide local values. Local simulation data is disabled unless `VITE_ENABLE_LOCAL_SIMULATION=true`.

## Quality Gates

```powershell
npm run lint
npm run test
npm run build
npm run test:e2e
```

Playwright uses installed Microsoft Edge outside CI and Playwright Chromium in CI. Database tests require a running local Supabase stack:

```powershell
supabase start
supabase db reset
supabase test db
```

Do not substitute the production project for local database tests.

## Data And Security Rules

- PostgreSQL fixture triggers are authoritative for prediction closeness and points.
- Predictions lock 24 hours before the first kickoff of their match week.
- Users can read and mutate only their own unlocked predictions.
- Disabled users are rejected by profile, prediction, avatar, and activity-log policies.
- Admin account status changes go through `/api/admin/user-status`, which verifies the database role and prevents self-disable.
- Password reset responses do not disclose whether an email exists.
- OAuth avatar caching accepts verified Google metadata only and stores bounded WebP output.
- Home data uses a fresh/stale cache and a database lease to prevent duplicate provider refreshes.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md). Development work stays on `dev`; production deploys from `main` only after migrations and local gates pass. Never push, migrate production, or trigger Netlify as part of routine local verification.

## Operations

- Health endpoint: `/api/health`
- Home data endpoint: `/api/home-data`
- Team details endpoint: `/api/team-details`
- Admin status endpoint: `/api/admin/user-status`
- Operational activity and expired cache rows are pruned during successful provider refreshes.
- Resend and scheduled Netlify Functions are intentionally not configured.
