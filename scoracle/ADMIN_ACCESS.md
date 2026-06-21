# Scoracle Admin Access

Admin route:

```text
/admin-soodlabs
```

## Create The Admin User

Create the admin user manually in Supabase Auth.

- Username: `SoodLabs`
- Email: `ADMIN_EMAIL_HERE`
- Password: create manually in Supabase Auth; do not store it in this repo

Use the normal Supabase Auth user creation flow or the Supabase dashboard. Make
sure the user metadata includes:

```json
{
  "username": "SoodLabs"
}
```

The database trigger will create a matching `public.profiles` row.

## Promote The User To Admin

After the profile row exists, run this SQL in Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin'
where username = 'SoodLabs';
```

## Notes

- Do not store the admin password in the repository.
- Do not email the admin password.
- Admin access is based on `public.profiles.role = 'admin'`, not username alone.
- Prefer disabling users over deleting them.
