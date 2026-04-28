# Supabase setup

One-time, takes ~2 minutes.

1. Open your Supabase project.
2. Left sidebar → **SQL Editor** → **New query**.
3. Paste the entire contents of `schema.sql` and click **Run**.
4. (Optional) Authentication → Providers → keep **Email** enabled.
   Authentication → Email Templates → **Magic Link** is what we use.

## After your first login

Once you log into the dashboard with `romolts1@gmail.com`, run this in the
SQL Editor *one time* to grant yourself owner permissions:

```sql
update public.profiles
set role = 'owner'
where id = (select id from auth.users where email = 'romolts1@gmail.com');
```

That's it.
