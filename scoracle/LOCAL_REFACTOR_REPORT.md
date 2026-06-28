# Local Production Refactor Report

## Scope

This report covers local `dev` only. No commit has been pushed, no production migration has been applied, and no Netlify deployment has been triggered.

Restore point: `restore/pre-production-refactor` at `4f2be99`.

## Implemented

- Added Vitest, Testing Library, Playwright, Zod, and TanStack Query foundations.
- Added shared Zod API contracts and TypeScript Netlify handlers.
- Added a global error boundary and lazy route loading.
- Centralized prediction persistence and removed browser-triggered scoring.
- Added PostgreSQL-authoritative fixture scoring and active-user RLS migration.
- Added joined prediction-history and rank-timeline RPCs.
- Added authenticated admin ban/unban handling with self-disable prevention.
- Removed password-reset account enumeration.
- Hardened OAuth avatar fetching and image decoding.
- Added fresh/stale home caching, provider timeouts/retries, and a sync lease.
- Removed direct browser provider requests and production simulation defaults.
- Added paginated admin data and removed pruning from admin page loads.
- Added optimized local WebP assets and route-level bundle splitting.
- Added searchable, accessible Help documentation on public, user, and admin screens.
- Added security headers and `/api/health`.

## Current Verification

- `npm run lint`: pass.
- `npm run test`: 23 tests pass across scoring, password, Help, provider validation, OAuth avatar safety, admin authorization, and RPC compatibility.
- `npm run build`: pass, including browser and Netlify TypeScript checks.
- `supabase db reset --local`: all 17 migrations apply from an empty database.
- `supabase db lint --local`: no schema errors.
- `supabase test db`: 15 pgTAP assertions pass across object privileges, RLS, active/disabled/admin access, 24-hour locking, and trigger-based scoring.
- Playwright: 8 tests pass across desktop and mobile, covering public Help, normal-user profile access, non-admin denial, disabled-user eviction, and admin access.
- Generated Supabase schema types are wired into the browser client.
- Largest emitted chunks: React 221.54 kB, Supabase 201.26 kB, home 85.83 kB before gzip. No Vite chunk warning.

## Defects Found By Local Database Testing

- Fresh Supabase projects no longer implicitly grant authenticated table privileges. Explicit least-privilege grants were added while preserving RLS row enforcement.
- `service_role` bypasses RLS but still needs SQL table privileges under modern defaults. Explicit application-table and sequence grants were added for Netlify sync, cache, avatar, and admin operations.
- A disabled-user sign-out event could erase the required disabled-account message. The auth state transition now preserves an explicit sign-out reason.
- Parallel Playwright workers overwhelmed the local Docker stack and created false failures. Local runs are serialized; CI remains capped at two workers.
- Profile and Leaderboard now fall back to the existing per-match-week rank RPCs when `get_rank_timeline()` has not yet been migrated, while unrelated database errors remain visible.
- Profile reconstructs prediction history from existing RLS-protected tables when `get_my_prediction_history()` has not yet been migrated.

## Remaining Risk

- A real Google OAuth round trip is not automated because it requires interactive external Google credentials; provider metadata extraction, URL validation, disabled-session handling, and avatar hardening are covered separately.
- `App.tsx`, `ProfilePage.tsx`, and `AdminPage.tsx` remain larger than the target architecture; further splitting should wait until database characterization tests are available.
- Provider degradation tests cover input/security boundaries but not every live upstream response variant.

## Approval Boundary

All local approval gates now pass. Do not push `dev`, apply production migrations, merge to `main`, or deploy Netlify until explicit approval is given.
