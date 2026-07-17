# Scoracle Test Deployment

## Deployment Architecture

Scoracle is deployed as a nested Vite app from `scoracle/`.

- Netlify: frontend hosting and Netlify Functions.
- Supabase: Auth, Postgres, Row Level Security, and Storage.
- Google Cloud: OAuth credentials only.
- Resend: deferred until a domain/email decision is made.

Netlify should deploy from `main`. Active development continues on `dev`.

## Local Pre-Deployment Checklist

- [ ] On `dev` branch.
- [ ] `npm install` completed in `scoracle/`.
- [ ] `npm run lint` passes.
- [ ] `npm run security:check` passes.
- [ ] `npm run build` passes.
- [ ] No secrets are committed.
- [ ] `.env` and `.env.local` are ignored.
- [ ] `.env.example` is current.
- [ ] Supabase migrations are checked.
- [ ] `public/_redirects` exists.
- [ ] `netlify.toml` is checked.

## Netlify Setup

Use:

```text
Netlify -> Add new site -> Import from Git -> GitHub -> Scoracle repo
```

Recommended settings:

```text
Branch: main
Base directory: scoracle
Build command: npm run build
Publish directory: dist
```

The app `package.json` is inside `scoracle/`, so the Netlify base directory must be `scoracle`.

## Netlify Environment Variables

Add these in Netlify site environment variables:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_EMAIL_NOTIFICATIONS_ENABLED=false
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
EMAIL_NOTIFICATIONS_ENABLED=false
SCORACLE_SEASON=2026
PULSE_COMP_SEASON_ID=841
PULSE_LEADERBOARD_FALLBACK_COMP_SEASON_ID=777
THESPORTSDB_KEY=123
INTERNAL_REFRESH_SECRET=GENERATE_A_LONG_RANDOM_SECRET
```

Never add the Supabase service role key, database password, Google client secret, Resend key, SMTP password, or private token to a `VITE_` variable or committed file.

`INTERNAL_REFRESH_SECRET` is server-only. It authorizes the demand-driven background cache refresh and must not use a `VITE_` prefix.

## Migration Order

Run all local quality and database gates before applying production migrations. Then use only:

```powershell
supabase migration list
supabase db push
```

Do not use `supabase db reset` against the linked production project. After deployment, verify `/api/health` returns a healthy response before testing authenticated writes.

## Supabase URL Configuration

After Netlify gives the deployed URL, open:

```text
Supabase -> Authentication -> URL Configuration
```

Set:

```text
Site URL = https://YOUR_NETLIFY_SITE.netlify.app
```

Add redirect URLs:

```text
http://localhost:5173/**
https://YOUR_NETLIFY_SITE.netlify.app/**
https://YOUR_NETLIFY_SITE.netlify.app/auth/callback
https://YOUR_NETLIFY_SITE.netlify.app/reset-password
```

Google returns to Supabase first at the Supabase callback URL; Supabase then redirects back to `/auth/callback` in the app.

## Google OAuth Configuration

After Netlify gives the deployed URL, open:

```text
Google Cloud Console -> APIs & Services -> Credentials -> Scoracle OAuth Client
```

Authorized JavaScript origins:

```text
http://localhost:5173
https://YOUR_NETLIFY_SITE.netlify.app
```

Authorized redirect URI:

```text
https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback
```

Do not remove the Supabase callback URL.

## Supabase Storage Avatars

Scoracle uses the public `profile-avatars` bucket for MVP profile display.

- Bucket: `profile-avatars`.
- Public read is intentional for simple avatar display.
- Users can upload/update/delete only files in their own user-id folder.
- Google OAuth avatars are cached through `/api/cache-oauth-avatar`.
- Fallback initials display when no avatar exists.

## Resend And Email Status

Resend is not configured yet.

- Keep `VITE_EMAIL_NOTIFICATIONS_ENABLED=false`.
- Keep `EMAIL_NOTIFICATIONS_ENABLED=false`.
- Do not call Resend APIs.
- Email confirmation should remain disabled for testing unless Supabase SMTP/custom email is configured.
- Google login should be used for internet testing.

Supabase Auth password reset emails still use Supabase's built-in auth email flow.

## Branch Workflow

```text
dev = active development
main = stable deployment branch
Netlify deploys from main
```

Do not merge `dev` into `main` until build, migrations, environment documentation, and local smoke testing are complete.

Deployment-prep commands:

```powershell
git checkout dev
git status
cd scoracle
npm install
npm run lint
npm run security:check
npm run build
supabase migration list
supabase db push
cd ..
git add scoracle/public/_redirects scoracle/netlify.toml scoracle/.env.example scoracle/.gitignore scoracle/DEPLOYMENT.md
git commit -m "Prepare Scoracle for Netlify test deployment"
git push origin dev

git checkout main
git pull origin main
git merge dev
git push origin main
git checkout dev
```

Production Netlify CLI deploys must not use `--debug` by default. Use `netlify deploy --prod --site <site-id>` unless a one-off incident response session explicitly requires debug logging.

Do not force push, rewrite history, reset the remote database, or delete branches.

## Post-Deployment Smoke Test

- [ ] Netlify home page opens.
- [ ] `/` returns the expected CSP, HSTS, XFO, nosniff, and referrer-policy headers.
- [ ] `/api/health` returns JSON with the expected security headers.
- [ ] Direct refresh on `/profile` works.
- [ ] Direct refresh on `/leaderboard` works.
- [ ] Direct refresh on `/admin-soodlabs` works.
- [ ] Direct refresh on `/auth/callback` works.
- [ ] Direct refresh on `/reset-password` works.
- [ ] Google login works.
- [ ] User profile loads.
- [ ] Google avatar and uploaded avatar display.
- [ ] Favorite club saves.
- [ ] Predictions save.
- [ ] Predictions remain after refresh.
- [ ] Locked match week is read-only.
- [ ] Completed match shows actual score and user prediction.
- [ ] Closeness color appears correctly.
- [ ] Leaderboard loads.
- [ ] Current user is highlighted in leaderboard.
- [ ] Logout works.
- [ ] Mobile view works.
