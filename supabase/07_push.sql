-- Run AFTER previous migrations, one time, in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Push notifications: stores Web Push subscriptions per auth user.
-- One user can have multiple subscriptions (phone + desktop).

-- Reminder timestamp on rides so the cron can dedupe.
alter table public.rides
  add column if not exists reminder_sent_at timestamptz;
create index if not exists rides_reminder_idx
  on public.rides (reminder_sent_at, pickup_at);

-- Subscriptions table.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  unique (user_id, endpoint)
);
create index if not exists push_subs_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Users manage their own subscriptions; owner can read all (so the
-- worker's service-role queries can find them, though service-role
-- bypasses RLS anyway).
drop policy if exists push_subs_self on public.push_subscriptions;
create policy push_subs_self on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists push_subs_owner_read on public.push_subscriptions;
create policy push_subs_owner_read on public.push_subscriptions
  for select using (public.is_owner());
