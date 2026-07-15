## Executive Summary

Pass 2 focused on application code logic, attack surface, and exploit classes in the current repository state for Scoracle. I traced the browser routes, Netlify functions, Supabase RPCs, and row-level-security-backed data flows rather than reviewing dependency issues from Pass 1.

I found three concrete issues:

1. Disabled users are still exposed through the leaderboard RPC family because the security-definer SQL aggregates all scored predictions for any authenticated caller instead of filtering out disabled accounts server-side.
2. The signup flow leaks whether an email address already has an account.
3. The signup UI plus anonymous `is_username_available` RPC provide a direct username-enumeration oracle.

I also checked modern/less-obvious classes including DOM XSS sinks, mXSS/sanitizer bypass preconditions, markdown HTML passthrough, SSRF in server fetches, WebSocket authorization, CSRF on custom endpoints, path traversal in file handling, mass assignment, IDOR, prototype pollution, SSTI, command injection, and recent Supabase/React-stack techniques. Those are listed below when they were checked and not found.

## Auth Surface Mapped

- Browser routes in `scoracle/src/app/AppRoutes.tsx:25`-`30`:
  - `/` is publicly reachable; mutation flows under it rely on an authenticated Supabase session plus RLS.
  - `/profile` and `/leaderboard` are browser-reachable routes that immediately depend on an authenticated user before loading protected data.
  - `/admin-soodlabs` is browser-reachable but intended for admins; mutations go through a separate server-side admin check.
  - `/auth/callback` and `/reset-password` are public entry points for auth flows.
- Netlify functions:
  - `scoracle/netlify/functions/home-data.ts` and `scoracle/netlify/functions/team-details.ts` are public GET surfaces.
  - `scoracle/netlify/functions/health.ts:6` is a public GET health check.
  - `scoracle/netlify/functions/cache-oauth-avatar.ts:25`-`39` requires a bearer access token.
  - `scoracle/netlify/functions/admin-user-status.ts:19`-`40` requires a bearer access token and then enforces `role === 'admin'` server-side.

## Findings

| Severity | Location (file:line) | Attack class | Description | Proof-of-concept sketch | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| Medium | `scoracle/src/pages/LeaderboardPage.tsx:61`, `scoracle/src/pages/ProfilePage.tsx:278`, `scoracle/src/data/leaderboard.ts:30`, `scoracle/src/data/leaderboard.ts:46`, `scoracle/src/data/leaderboard.ts:66`, `scoracle/src/data/leaderboard.ts:106`, `scoracle/supabase/migrations/20260622160000_user_avatar_sync_and_leaderboard_photos.sql:135`, `scoracle/supabase/migrations/20260622160000_user_avatar_sync_and_leaderboard_photos.sql:186`, `scoracle/supabase/migrations/20260622160000_user_avatar_sync_and_leaderboard_photos.sql:229`, `scoracle/supabase/migrations/20260628090000_production_hardening.sql:272` | Authorization / post-disable data exposure | Authenticated users load leaderboard data through `fetchOverallLeaderboard()`, `fetchMatchWeekLeaderboard()`, fallback `fetchRankMovement()`, and `fetchRankTimeline()`. The underlying security-definer SQL functions aggregate scored predictions with only `auth.uid() is not null` or caller-scoped `public.is_active_user()` checks, then join to `profiles`, but they do not filter out disabled users' rows. Result: after an account is disabled, other users can still see that user's username, avatar, club, points, and rank history on the leaderboard and in profile rank lookups. | 1. Create user A and user B. 2. Let B make predictions that get scored. 3. Disable B through the admin flow. 4. Sign in as A and open `/leaderboard` or `/profile`. 5. B still appears in overall or historical leaderboard data because the RPCs aggregate B's scored rows. | Add a shared server-side visibility predicate for leaderboard users, for example joining `profiles` with `is_disabled = false`, and apply it consistently to `get_overall_leaderboard`, `get_match_week_leaderboard`, `get_match_week_rank_movement`, and `get_rank_timeline`. Prefer one shared helper/view so the filter cannot drift again. |
| Medium | `scoracle/src/components/auth/SignupModal.tsx:90`, `scoracle/src/components/auth/SignupModal.tsx:102`, `scoracle/src/context/AuthContext.tsx:200`, `scoracle/src/context/AuthContext.tsx:217`, `scoracle/src/context/AuthContext.tsx:218` | User enumeration | The signup flow returns a distinct error when the submitted email already has an account. `SignupModal` submits attacker-controlled email input to `signUp()`, and `signUp()` explicitly throws `An account with this email already exists.` when Supabase returns a user object with zero identities. That gives anonymous callers an oracle for whether a target email is registered. | Submit signup with a fresh username and the target email. If the email already exists, the UI returns `An account with this email already exists.` If it does not, the flow returns an account-created message instead. | Normalize signup responses so account existence is not distinguishable. Return the same generic outcome for existing and new email addresses, and log the exact reason only server-side. |
| Low | `scoracle/src/components/auth/SignupModal.tsx:52`, `scoracle/src/components/auth/SignupModal.tsx:56`, `scoracle/src/components/auth/SignupModal.tsx:191`, `scoracle/src/components/auth/SignupModal.tsx:204`, `scoracle/src/context/AuthContext.tsx:171`, `scoracle/supabase/migrations/20260622100000_normalize_username_spacing.sql:12`, `scoracle/supabase/migrations/20260622100000_normalize_username_spacing.sql:22`, `scoracle/supabase/migrations/20260622100000_normalize_username_spacing.sql:130` | User enumeration | The signup form debounces every candidate username into `checkUsernameAvailability()`, and the anonymous security-definer RPC `is_username_available()` returns a precise boolean for whether that username is already present. The UI then exposes that result directly as `Username is available.` or `That username is already taken.` This is a clean anonymous oracle for enumerating valid usernames. | Open the signup modal while logged out, type candidate usernames, and watch the result flip between `available` and `taken` without ever creating an account. The same can be scripted by calling the RPC directly as an anonymous client. | Remove or heavily degrade the anonymous oracle. Good options are: require authentication or human verification before availability checks, rate-limit the endpoint aggressively, return only generic feedback, or move uniqueness handling to final submission and present suggestions instead of a binary answer. |

## Attack Classes Checked But Not Found

- IDOR on prediction CRUD was checked and not found. Client code sends attacker-controlled identifiers in `scoracle/src/features/predictions/predictionRepository.ts:19`-`54`, but Postgres RLS in `scoracle/supabase/migrations/20260628090000_production_hardening.sql:28`-`70` binds read/write/delete to `auth.uid()` and unlocked fixtures.
- Mass assignment on profile and admin updates was checked and not found. The client only submits editable profile fields in `scoracle/src/context/AuthContext.tsx:377`-`384`, and the trigger/policy layer blocks privilege-bearing fields like `role` and `is_disabled`. The admin status endpoint only accepts `{ targetUserId, disabled }` in `scoracle/netlify/functions/admin-user-status.ts:78`-`95`.
- Stored, reflected, and DOM XSS sinks were checked and not found. Repo-wide searches found no `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `document.write`, `eval`, `Function`, or markdown-to-HTML rendering path. `AuthCallbackPage` renders query-string error text through normal React text nodes in `scoracle/src/pages/AuthCallbackPage.tsx:79`-`87`, which React escapes.
- mXSS / sanitizer-bypass conditions were checked and not found. The repo does not use DOMPurify or another HTML sanitizer, which also means there is no sanitizer-based gadget chain to exploit here.
- SVG/file-upload XSS was checked and not found in the implemented avatar paths. Client uploads accept only JPEG/PNG/WebP in `scoracle/src/pages/ProfilePage.tsx:429`-`440`, and the server-side Google-avatar cache re-encodes accepted images to WebP in `scoracle/netlify/functions/cache-oauth-avatar.ts:196`-`220`.
- SSRF was checked and not found in the server fetch paths. `team-details` and `home-data` fetch fixed upstream hosts, while `cache-oauth-avatar` restricts scheme and host, resolves DNS, blocks private/loopback/metadata IPs, and limits redirects in `scoracle/netlify/functions/cache-oauth-avatar.ts:88`-`160`.
- SQL injection, SSTI, command injection, prototype pollution, and insecure deserialization were checked and not found. The audited code uses Supabase client/query builders and fixed SQL/RPC entry points rather than template-string SQL, shell execution, or unsafe deserializers.
- WebSocket authorization was checked and not found to be missing. Chat subscriptions use Supabase `postgres_changes` in `scoracle/src/features/chat/chatRepository.ts:78`-`95`, and message insertion is constrained by RLS to `auth.uid() = user_id` in the chat migration.
- CSRF on custom server-side mutations was checked and not found as a primary issue. Sensitive Netlify mutations use explicit bearer tokens in `scoracle/src/features/admin/adminRepository.ts:123`-`127` and `scoracle/src/context/AuthContext.tsx:557`, not ambient cookie-only auth.
- Service worker cache poisoning was checked and not found. I did not find service worker registration or a custom service worker file in the repo.
- Clickjacking defenses were checked and look present in hosting config via `frame-ancestors 'none'` in `scoracle/netlify.toml:40`.

## Recent / Emerging Techniques Checked

- I specifically checked for recent sanitizer-bypass and mXSS-style XSS techniques that would matter if the app used raw HTML rendering. That class is not currently reachable because the repo does not use a sanitizer library or raw HTML sink.
- I checked Supabase-specific OAuth callback handling concerns. The app exchanges the OAuth code through `supabase.auth.exchangeCodeForSession()` in `scoracle/src/pages/AuthCallbackPage.tsx:25`, and the local Supabase auth config keeps `skip_nonce_check = false` in `scoracle/supabase/config.toml:332`-`333`.
- I checked Supabase Realtime-specific authorization expectations. The implemented chat flow uses row-backed `postgres_changes` subscriptions instead of unauthenticated broadcast semantics, and the backing table has active-user RLS.
- I also web-checked recent stack-relevant discussions/advisories around Supabase auth/realtime and modern XSS bypass techniques. I did not find a last-12-month framework-specific bypass that changed the concrete conclusions above for this codebase.

## Quick Wins

- Fix the leaderboard SQL family first. A single shared predicate or view excluding disabled profiles will close the highest-impact issue across multiple screens at once.
- Remove specific signup account-existence messages. Returning the same message for both existing and new emails is a small code change with immediate enumeration payoff.
- Remove or gate the anonymous username-availability oracle. Even a basic rate limit plus generic messaging would materially reduce harvesting risk.
- If `scoracle/supabase/config.toml` is the source of truth for deployed auth settings, enable CAPTCHA and tighten auth abuse controls around signup and reset flows as defense in depth.
