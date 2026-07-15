# Scoracle Security Audit - Pass 1

Pass 1 scope only: dependencies, secrets, and infrastructure/platform configuration. Application business logic was intentionally not reviewed in this pass.

## Executive Summary

Scoracle's repo-state shows one critical secret-management issue and two concrete platform-hardening gaps. The most serious problem is a live-looking Supabase `service_role` key stored in the local working tree at `scoracle/.env.local:15`. I verified that this file is ignored by Git and that the same secret string does not appear in tracked history, but it is still present in plaintext on disk and grants full backend-level access if valid.

On the infrastructure side, Netlify security headers are partially configured, but `Strict-Transport-Security` is missing and the CSP still permits inline styles via `style-src 'unsafe-inline'`. I did not find any repo evidence of permissive CORS, open redirects, client-side use of the service-role key, or obviously over-permissive RLS on sensitive user tables.

For supply-chain review, the app is npm-only and the resolved dependency tree currently contains 334 packages. The only packages in the lockfile with install scripts are optional `fsevents` packages. I manually cross-checked current Vite advisories in the GitHub Advisory Database and confirmed the lockfile's `vite@8.0.16` is newer than the affected ranges for the April 2026 Vite dev-server file-read/path-traversal CVEs. Automated `npm audit --json` could not be completed because tenant policy blocked uploading the private lockfile/dependency graph to npm's external audit service; the raw failure output is included below.

## Findings

| Severity | Location | Issue | Impact | Recommended fix |
| --- | --- | --- | --- | --- |
| Critical | `scoracle/.env.local:14-15` | Plaintext Supabase service-role credential stored in the working tree. `SUPABASE_SERVICE_ROLE_KEY` is present alongside the project URL. | A valid Supabase service-role key bypasses RLS and can read/write protected data, invoke privileged backend operations, and administer Auth-backed data paths. Even though the file is Git-ignored, any local compromise, accidental archive/share, editor plugin leak, or backup exposure compromises the backend. | Rotate the service-role key immediately in Supabase. Remove the plaintext key from `.env.local`. Store it only in trusted secret stores/runtime env injection. Audit Netlify/GitHub/CI secrets for reuse and review Supabase logs for misuse. |
| Medium | `scoracle/netlify.toml:37-44` | `Strict-Transport-Security` header is missing. | Without HSTS, browsers are not instructed to pin HTTPS for future visits. That weakens downgrade/SSL-stripping resistance, especially for first-visit traffic or custom-domain deployments. | Add `Strict-Transport-Security` with an appropriate max-age, and include `includeSubDomains`/`preload` only after confirming the domain is ready for preload semantics. |
| Low | `scoracle/netlify.toml:40` | CSP is present but not fully restrictive because `style-src` allows `'unsafe-inline'`. | This does not enable script execution, but it weakens CSP's protection against CSS injection and makes future CSP hardening harder. | Remove `'unsafe-inline'` from `style-src` by moving inline styles to static CSS or using nonces/hashes where truly necessary. |
| Medium | `.github/workflows/scoracle-supabase-maintenance.yml:1-37` and missing `.github/dependabot.yml` / repo-local SCA workflow | No repo-native dependency vulnerability scanning automation is configured. The only checked-in workflow is maintenance; there is no Dependabot or equivalent CI vulnerability gate in the repo. | New CVEs or malicious package releases can sit undetected between manual reviews, which is especially relevant in the current npm threat climate. | Add automated dependency monitoring such as Dependabot alerts/PRs, OSV-Scanner or equivalent in CI, and a policy for reacting to malicious-release incidents. Prefer an internal/offline-capable scanner for private repos if lockfile upload is restricted. |

## Dependency Review

### Resolved dependency inventory

- Package manager: npm
- App manifest reviewed: `scoracle/package.json`
- Lockfile reviewed: `scoracle/package-lock.json`
- Resolved packages in lockfile: 334
- Direct runtime dependencies: 10
- Direct dev dependencies: 18
- Packages with install scripts in the lockfile: `fsevents@2.3.3`, `playwright/node_modules/fsevents@2.3.2`
- Obvious internal/private package names: none found
- Docker/base-image artifacts: none found in repo

### Reachability / applicability notes

- Browser code uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `scoracle/src/lib/supabaseClient.ts:4-18`.
- Server-side code reads `SUPABASE_SERVICE_ROLE_KEY` only from process environment in `scoracle/netlify/core/supabase.ts:1-16`.
- The default dev script is `vite` without `--host` in `scoracle/package.json:7`, and the checked-in Vite config does not set `server.host` in `scoracle/vite.config.ts:23-35`.
- Because of that, the April 2026 Vite dev-server advisories I verified are not currently applicable here by version, and they are not additionally exposed by a checked-in network-facing dev-server config.

### Recent supply-chain incident checks

- I reviewed recent 2025-2026 npm compromise reporting for the Axios incident and the TanStack/Mini Shai-Hulud incident.
- No exact matches for the named compromised packages from the reviewed reporting were found in the current lockfile. In particular, the repo uses `@tanstack/react-query`, not the reported compromised TanStack packages `@tanstack/react-router`, `@tanstack/history`, or `@tanstack/router-core`.
- This is not a guarantee of safety; it only means I did not find an exact package-name match against the incidents I checked.

### Dependency table

No currently pinned package version was confirmed vulnerable from the advisories I was able to verify. The table below records the advisories I checked and why they do **not** currently apply.

| package | current version | vulnerable version range | recommended version | CVE link |
| --- | --- | --- | --- | --- |
| `vite` | `8.0.16` | `>= 8.0.0, <= 8.0.4`; `>= 7.0.0, <= 7.3.1`; `>= 6.0.0, <= 6.4.1` | Already fixed; stay `>= 8.0.5` | https://github.com/advisories/GHSA-p9ff-h696-f583 |
| `vite` | `8.0.16` | `>= 8.0.0, <= 8.0.4`; `>= 7.1.0, <= 7.3.1` | Already fixed; stay `>= 8.0.5` | https://github.com/advisories/GHSA-v2wj-q39q-566r |
| `vite` | `8.0.16` | `>= 8.0.0, <= 8.0.4`; `>= 7.0.0, <= 7.3.1`; `<= 6.4.1` | Already fixed; stay `>= 8.0.5` | https://github.com/advisories/GHSA-4w7w-66w2-5vf9 |

## Secrets & Key Management Review

### Confirmed secret exposure

- `scoracle/.env.local:15` contains a Supabase `service_role` JWT-like credential.
- `scoracle/.env.local:14` points to the matching Supabase project URL.

### What I verified

- `scoracle/.gitignore:15-19` ignores `.env.local` and other local env files.
- `git ls-files` shows `scoracle/.env.local` is **not** tracked.
- `git grep` across all commits did **not** find the current project ID or current service-role secret string in tracked Git history.
- Browser code does **not** reference `SUPABASE_SERVICE_ROLE_KEY`; client code only consumes the anon key in `scoracle/src/lib/supabaseClient.ts:4-18`.
- Server/runtime code does consume the service-role key from environment variables in `scoracle/netlify/core/supabase.ts:1-16`, which is an acceptable pattern if the key stays server-side.

### Additional observations

- `.env.example` is a template only and does not contain live secrets.
- I did not find tracked private keys, AWS access keys, GitHub PATs, Slack tokens, or Postgres connection strings in tracked history using pattern-based searches.

## Network / Platform Configuration Review

### Security headers

Configured in `scoracle/netlify.toml:37-44`:

- Present: `Content-Security-Policy`
- Present: `Referrer-Policy`
- Present: `X-Content-Type-Options`
- Present: `X-Frame-Options`
- Present: `Permissions-Policy`
- Missing: `Strict-Transport-Security`

CSP notes:

- Positive: no `unsafe-eval`; `script-src 'self'`; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'`
- Gap: `style-src 'unsafe-inline'`

### Redirects / rewrites

- `scoracle/public/_redirects:1-6` and `scoracle/netlify.toml:12-35` only route to internal Netlify functions or `index.html`.
- I did not find a checked-in open redirect pattern in redirects/rewrites.

### CORS

- I did not find explicit `Access-Control-Allow-Origin` or `Access-Control-Allow-Credentials` headers in the repo.
- Based on repo evidence alone, the Netlify function endpoints appear intended for same-origin use.
- I did not find a wildcard-with-credentials CORS misconfiguration in checked-in code/config.

### Supabase / RLS

- RLS is enabled on sensitive tables in the migrations I reviewed.
- I did not find blanket `USING (true)` policies on user-sensitive tables. The visible `USING (true)` policies in `scoracle/supabase/migrations/20260622110000_predictions_profile_schema.sql:213-225` apply to `teams` and `fixtures`, which appear to be public reference data rather than user-private records.
- Service-role access is intentionally granted in several migrations; that is expected for server-side jobs/functions, but it makes the leaked service-role key especially dangerous.

## Limitations

- `npm audit --json` could not be completed because tenant policy blocked sending the private dependency graph/package-lock metadata to npm's external audit service. I did not attempt to bypass that restriction.
- I could not verify live Netlify dashboard environment scoping, deployed headers on the production hostname, custom-domain DNS state, or actual subdomain-takeover exposure from repo contents alone.
- I did not review application code logic in this pass by request.

## Appendix: Raw Scanner / Command Output

### Raw `npm audit --json` output

```text
{
  "message": "request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed, reason: ",
  "error": {
    "summary": "",
    "detail": ""
  }
}
npm warn audit request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed, reason:
npm error audit endpoint returned an error
npm error Log files were not written due to an error writing to the directory: C:\Users\rishisood\AppData\Local\npm-cache\_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal
```

### Raw lockfile metadata scan output

Command used: local Node.js script over `scoracle/package-lock.json`

```json
{
  "totalPackages": 334,
  "withInstallScripts": [
    {
      "name": "fsevents",
      "version": "2.3.3",
      "hasInstallScript": true,
      "scripts": null
    },
    {
      "name": "playwright/node_modules/fsevents",
      "version": "2.3.2",
      "hasInstallScript": true,
      "scripts": null
    }
  ],
  "licenses": [
    [
      "0BSD",
      1
    ],
    [
      "Apache-2.0",
      34
    ],
    [
      "Apache-2.0 AND LGPL-3.0-or-later",
      3
    ],
    [
      "Apache-2.0 AND LGPL-3.0-or-later AND MIT",
      1
    ],
    [
      "BlueOak-1.0.0",
      2
    ],
    [
      "BSD-2-Clause",
      8
    ],
    [
      "BSD-3-Clause",
      3
    ],
    [
      "CC-BY-4.0",
      1
    ],
    [
      "CC0-1.0",
      1
    ],
    [
      "ISC",
      15
    ],
    [
      "LGPL-3.0-or-later",
      10
    ],
    [
      "MIT",
      241
    ],
    [
      "MIT-0",
      2
    ],
    [
      "MPL-2.0",
      12
    ]
  ]
}
```

### Raw direct dependency resolution output

```json
[
  {
    "name": "@eslint/js",
    "requested": "^10.0.1",
    "resolved": "10.0.1",
    "dev": true
  },
  {
    "name": "@playwright/test",
    "requested": "^1.61.1",
    "resolved": "1.61.1",
    "dev": true
  },
  {
    "name": "@supabase/supabase-js",
    "requested": "^2.108.2",
    "resolved": "2.108.2",
    "dev": false
  },
  {
    "name": "@tailwindcss/vite",
    "requested": "^4.3.1",
    "resolved": "4.3.1",
    "dev": false
  },
  {
    "name": "@tanstack/react-query",
    "requested": "^5.101.1",
    "resolved": "5.101.1",
    "dev": false
  },
  {
    "name": "@testing-library/jest-dom",
    "requested": "^6.9.1",
    "resolved": "6.9.1",
    "dev": true
  },
  {
    "name": "@testing-library/react",
    "requested": "^16.3.2",
    "resolved": "16.3.2",
    "dev": true
  },
  {
    "name": "@testing-library/user-event",
    "requested": "^14.6.1",
    "resolved": "14.6.1",
    "dev": true
  },
  {
    "name": "@types/node",
    "requested": "^24.12.3",
    "resolved": "24.13.2",
    "dev": true
  },
  {
    "name": "@types/react",
    "requested": "^19.2.14",
    "resolved": "19.2.17",
    "dev": true
  },
  {
    "name": "@types/react-dom",
    "requested": "^19.2.3",
    "resolved": "19.2.3",
    "dev": true
  },
  {
    "name": "@vitejs/plugin-react",
    "requested": "^6.0.1",
    "resolved": "6.0.2",
    "dev": true
  },
  {
    "name": "eslint",
    "requested": "^10.3.0",
    "resolved": "10.5.0",
    "dev": true
  },
  {
    "name": "eslint-plugin-react-hooks",
    "requested": "^7.1.1",
    "resolved": "7.1.1",
    "dev": true
  },
  {
    "name": "eslint-plugin-react-refresh",
    "requested": "^0.5.2",
    "resolved": "0.5.3",
    "dev": true
  },
  {
    "name": "globals",
    "requested": "^17.6.0",
    "resolved": "17.6.0",
    "dev": true
  },
  {
    "name": "jsdom",
    "requested": "^29.1.1",
    "resolved": "29.1.1",
    "dev": true
  },
  {
    "name": "lucide-react",
    "requested": "^1.21.0",
    "resolved": "1.21.0",
    "dev": false
  },
  {
    "name": "react",
    "requested": "^19.2.6",
    "resolved": "19.2.7",
    "dev": false
  },
  {
    "name": "react-dom",
    "requested": "^19.2.6",
    "resolved": "19.2.7",
    "dev": false
  },
  {
    "name": "react-router",
    "requested": "^8.0.1",
    "resolved": "8.0.1",
    "dev": false
  },
  {
    "name": "sharp",
    "requested": "^0.35.2",
    "resolved": "0.35.2",
    "dev": false
  },
  {
    "name": "tailwindcss",
    "requested": "^4.3.1",
    "resolved": "4.3.1",
    "dev": false
  },
  {
    "name": "typescript",
    "requested": "~6.0.2",
    "resolved": "6.0.3",
    "dev": true
  },
  {
    "name": "typescript-eslint",
    "requested": "^8.59.2",
    "resolved": "8.61.1",
    "dev": true
  },
  {
    "name": "vite",
    "requested": "^8.0.12",
    "resolved": "8.0.16",
    "dev": true
  },
  {
    "name": "vitest",
    "requested": "^4.1.9",
    "resolved": "4.1.9",
    "dev": true
  },
  {
    "name": "zod",
    "requested": "^4.4.3",
    "resolved": "4.4.3",
    "dev": false
  }
]
```

## Sources

- GitHub Advisory Database, Vite advisory search/results page: https://github.com/advisories?query=vite
- GitHub Advisory Database, `CVE-2026-39363` / `GHSA-p9ff-h696-f583`: https://github.com/advisories/GHSA-p9ff-h696-f583
- GitHub Advisory Database, `CVE-2026-39364` / `GHSA-v2wj-q39q-566r`: https://github.com/advisories/GHSA-v2wj-q39q-566r
- GitHub Advisory Database, `CVE-2026-39365` / `GHSA-4w7w-66w2-5vf9`: https://github.com/advisories/GHSA-4w7w-66w2-5vf9
- Reporting on recent TanStack/Mini Shai-Hulud npm compromise (used only to compare package names against the lockfile): https://www.tomshardware.com/tech-industry/cyber-security/compromised-mistral-ai-and-tanstack-packages-may-have-exposed-github-cloud-and-ci-cd-credentials-in-mini-shai-hulud-malware-infection-supply-chain-campaign-spreads-across-npm-and-ai-developer-ecosystems-like-wildfire
- Reporting on recent Axios npm compromise (used only to compare package names against the lockfile): https://www.axios.com/2026/03/31/north-korean-hackers-implicated-in-major-supply-chain-attack
