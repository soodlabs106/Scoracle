## Release Checklist

- [ ] No unsafe HTML rendering was added (`dangerouslySetInnerHTML`, raw `innerHTML`, `eval`, `new Function`, `document.write`).
- [ ] No public signup, forgot-password, or account-recovery copy regressed into user enumeration.
- [ ] No new `SUPABASE_SERVICE_ROLE_KEY` endpoint or helper was added without explicit auth review.
- [ ] Netlify security headers are still present for `/` and `/api/*`.
- [ ] Production Netlify deploy steps do not use `--debug` by default.
- [ ] No secrets or literal credentials were committed.
