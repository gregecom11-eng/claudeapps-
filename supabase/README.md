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

## Adding migrations

The numbered files (`02_…sql` … `08_…sql`) are migrations that run in order
on top of `schema.sql`. They're idempotent — safe to re-run. Apply each one
the same way: paste into a new SQL Editor query and click **Run**.

`08_notifications.sql` adds the notification dispatcher: an outbox
(`notification_events`), per-user prefs and quiet hours, a delivery log,
and triggers on `rides` that auto-enqueue events on create / assign /
status change / cancellation. The Cloudflare cron worker reads the outbox
every ~5 minutes and sends the actual Web Push messages.
