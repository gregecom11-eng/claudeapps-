-- Run AFTER previous migrations, one time, in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Notifications v2: outbox + dispatcher.
--
-- Producers (DB triggers, cron) insert rows into `notification_events`.
-- A single dispatcher (worker cron) reads pending events, resolves
-- recipients, calls Web Push, and records per-endpoint outcomes in
-- `notification_deliveries`. Per-user toggles + quiet hours live in
-- `notification_prefs`.

-- ── Event kinds enum ──────────────────────────────────────────────
do $$ begin
  create type notification_kind as enum (
    'ride_created',         -- new public booking landed (→ owners)
    'ride_assigned',        -- a driver was attached (→ that driver)
    'ride_status_changed',  -- on_the_way / arrived / in_progress / completed
                            -- (→ client when relevant; → owners always)
    'ride_cancelled',       -- (→ driver if assigned, → client, → owners)
    'pickup_reminder'       -- t-90 (→ assigned driver)
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_status as enum (
    'pending', 'sent', 'failed', 'skipped'
  );
exception when duplicate_object then null; end $$;

-- ── Outbox: every push that should fire goes here first ───────────
create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  kind notification_kind not null,
  ride_id uuid references public.rides(id) on delete cascade,
  -- Who *should* receive it. The dispatcher resolves these into
  -- subscriptions, after applying notification_prefs / quiet hours.
  -- Each entry is { user_id } or { role: 'owner' }.
  recipients jsonb not null default '[]'::jsonb,
  -- Pre-built notification body. Title/body/url/tag/urgency.
  payload jsonb not null,
  -- When the dispatcher should consider this event. now() for instant
  -- events; future timestamps for time-relative ones (t-90 reminders).
  scheduled_for timestamptz not null default now(),
  -- Lifecycle.
  status notification_status not null default 'pending',
  attempts int not null default 0,
  last_error text,
  -- Audit.
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  -- Lets producers be idempotent: e.g. (kind=ride_created, ride_id=X)
  -- can only exist once. Optional — rows without this are always unique.
  dedupe_key text,
  unique (dedupe_key)
);
create index if not exists notif_events_due_idx
  on public.notification_events (status, scheduled_for)
  where status = 'pending';
create index if not exists notif_events_ride_idx
  on public.notification_events (ride_id);
create index if not exists notif_events_kind_idx
  on public.notification_events (kind, created_at desc);

alter table public.notification_events enable row level security;

-- Owners can read everything for the inbox view.
drop policy if exists notif_events_owner_read on public.notification_events;
create policy notif_events_owner_read on public.notification_events
  for select using (public.is_owner());

-- Drivers / clients can see events that targeted them.
drop policy if exists notif_events_recipient_read on public.notification_events;
create policy notif_events_recipient_read on public.notification_events
  for select using (
    recipients @> jsonb_build_array(jsonb_build_object('user_id', auth.uid()::text))
  );

-- ── Per-user prefs ────────────────────────────────────────────────
-- One row per (user, kind). Missing rows = enabled (sensible default).
create table if not exists public.notification_prefs (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind notification_kind not null,
  enabled boolean not null default true,
  primary key (user_id, kind)
);

-- Quiet hours apply to every kind except 'ride_cancelled' and
-- 'ride_created' (those bypass quiet hours — too important to silence).
-- Stored as local-time HH:MM in the user's tz; if start = end, no quiet
-- hours. Defaults to 22:00–07:00 America/Los_Angeles.
create table if not exists public.notification_quiet_hours (
  user_id uuid primary key references auth.users(id) on delete cascade,
  start_local time not null default '22:00',
  end_local   time not null default '07:00',
  tz          text not null default 'America/Los_Angeles',
  updated_at  timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;
alter table public.notification_quiet_hours enable row level security;

drop policy if exists notif_prefs_self on public.notification_prefs;
create policy notif_prefs_self on public.notification_prefs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notif_quiet_self on public.notification_quiet_hours;
create policy notif_quiet_self on public.notification_quiet_hours
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Owners can read prefs to debug routing decisions.
drop policy if exists notif_prefs_owner_read on public.notification_prefs;
create policy notif_prefs_owner_read on public.notification_prefs
  for select using (public.is_owner());
drop policy if exists notif_quiet_owner_read on public.notification_quiet_hours;
create policy notif_quiet_owner_read on public.notification_quiet_hours
  for select using (public.is_owner());

-- ── Per-endpoint delivery log ────────────────────────────────────
-- One row per (event, subscription) the dispatcher attempts.
create table if not exists public.notification_deliveries (
  id bigserial primary key,
  event_id uuid not null references public.notification_events(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  user_id uuid not null,
  http_status int,
  ok boolean not null default false,
  error text,
  sent_at timestamptz not null default now()
);
create index if not exists notif_deliv_event_idx
  on public.notification_deliveries (event_id);
create index if not exists notif_deliv_user_idx
  on public.notification_deliveries (user_id, sent_at desc);

alter table public.notification_deliveries enable row level security;

drop policy if exists notif_deliv_owner_read on public.notification_deliveries;
create policy notif_deliv_owner_read on public.notification_deliveries
  for select using (public.is_owner());
drop policy if exists notif_deliv_self_read on public.notification_deliveries;
create policy notif_deliv_self_read on public.notification_deliveries
  for select using (user_id = auth.uid());

-- ── Helper: enqueue from triggers ────────────────────────────────
create or replace function public.enqueue_notification(
  p_kind notification_kind,
  p_ride_id uuid,
  p_recipients jsonb,
  p_payload jsonb,
  p_scheduled_for timestamptz default now(),
  p_dedupe_key text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.notification_events
    (kind, ride_id, recipients, payload, scheduled_for, dedupe_key)
  values
    (p_kind, p_ride_id, p_recipients, p_payload, p_scheduled_for, p_dedupe_key)
  on conflict (dedupe_key) do nothing
  returning id into new_id;
  return new_id;
end;
$$;

-- ── Triggers on rides ────────────────────────────────────────────
-- Pure data layer: just records intent. The dispatcher is the only
-- thing that knows how to translate intent into pushes.
create or replace function public.rides_notify_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  client_user_id uuid;
  driver_user_id uuid;
  pickup_label text;
  loc_label text;
begin
  -- Pre-compute friendly bits.
  pickup_label := to_char(
    new.pickup_at at time zone 'America/Los_Angeles',
    'FMHH12:MIam'
  );
  loc_label := new.pickup_address;
  if new.dropoff_address is not null then
    loc_label := loc_label || ' → ' || new.dropoff_address;
  end if;

  -- Driver auth user (if assigned).
  if new.driver_id is not null then
    select profile_id into driver_user_id
      from public.drivers where id = new.driver_id;
  end if;
  -- Client auth user (if linked).
  if new.client_id is not null then
    select profile_id into client_user_id
      from public.clients where id = new.client_id;
  end if;

  if (tg_op = 'INSERT') then
    -- New booking from the public form → owners.
    if new.source = 'booking_form' then
      perform public.enqueue_notification(
        'ride_created',
        new.id,
        jsonb_build_array(jsonb_build_object('role', 'owner')),
        jsonb_build_object(
          'title', 'New booking · ' || new.passenger_name,
          'body',  pickup_label || ' · ' || loc_label,
          'url',   '/rides/' || new.id,
          'tag',   'ride-created-' || new.id,
          'urgency', 'high'
        ),
        now(),
        'ride_created:' || new.id
      );
    end if;
    -- If created with a driver already assigned, ping them.
    if driver_user_id is not null then
      perform public.enqueue_notification(
        'ride_assigned',
        new.id,
        jsonb_build_array(jsonb_build_object('user_id', driver_user_id::text)),
        jsonb_build_object(
          'title', 'New ride assigned · ' || new.passenger_name,
          'body',  pickup_label || ' · ' || loc_label,
          'url',   '/',
          'tag',   'ride-assigned-' || new.id,
          'urgency', 'normal'
        ),
        now(),
        'ride_assigned:' || new.id || ':' || driver_user_id::text
      );
    end if;
    return new;
  end if;

  if (tg_op = 'UPDATE') then
    -- Driver newly attached (or swapped) → ping new driver.
    if new.driver_id is distinct from old.driver_id and driver_user_id is not null then
      perform public.enqueue_notification(
        'ride_assigned',
        new.id,
        jsonb_build_array(jsonb_build_object('user_id', driver_user_id::text)),
        jsonb_build_object(
          'title', 'New ride assigned · ' || new.passenger_name,
          'body',  pickup_label || ' · ' || loc_label,
          'url',   '/',
          'tag',   'ride-assigned-' || new.id,
          'urgency', 'normal'
        ),
        now(),
        'ride_assigned:' || new.id || ':' || driver_user_id::text
      );
    end if;

    -- Status transitions.
    if new.status is distinct from old.status then
      if new.status = 'cancelled' then
        -- Loud event: notify everyone involved.
        declare
          recips jsonb := jsonb_build_array(
            jsonb_build_object('role', 'owner')
          );
        begin
          if driver_user_id is not null then
            recips := recips || jsonb_build_array(
              jsonb_build_object('user_id', driver_user_id::text)
            );
          end if;
          if client_user_id is not null then
            recips := recips || jsonb_build_array(
              jsonb_build_object('user_id', client_user_id::text)
            );
          end if;
          perform public.enqueue_notification(
            'ride_cancelled',
            new.id,
            recips,
            jsonb_build_object(
              'title', 'Ride cancelled · ' || new.passenger_name,
              'body',  pickup_label || ' · ' || loc_label,
              'url',   '/rides/' || new.id,
              'tag',   'ride-cancelled-' || new.id,
              'urgency', 'high'
            ),
            now(),
            'ride_cancelled:' || new.id
          );
        end;
      else
        -- Other status flips: notify client (if linked) + owners.
        declare
          recips jsonb := jsonb_build_array(
            jsonb_build_object('role', 'owner')
          );
          status_label text;
        begin
          if client_user_id is not null then
            recips := recips || jsonb_build_array(
              jsonb_build_object('user_id', client_user_id::text)
            );
          end if;
          status_label := case new.status
            when 'on_the_way'  then 'Driver on the way'
            when 'arrived'     then 'Driver has arrived'
            when 'in_progress' then 'Trip in progress'
            when 'completed'   then 'Trip completed'
            when 'scheduled'   then 'Booking confirmed'
            else 'Status: ' || new.status::text
          end;
          perform public.enqueue_notification(
            'ride_status_changed',
            new.id,
            recips,
            jsonb_build_object(
              'title', status_label || ' · ' || new.passenger_name,
              'body',  pickup_label || ' · ' || loc_label,
              'url',   '/rides/' || new.id,
              'tag',   'ride-status-' || new.id,
              'urgency', case
                when new.status in ('on_the_way','arrived') then 'high'
                else 'normal'
              end
            ),
            now()
            -- No dedupe_key: each transition is its own event.
          );
        end;
      end if;
    end if;
    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists rides_notify on public.rides;
create trigger rides_notify
  after insert or update on public.rides
  for each row execute function public.rides_notify_trigger();

-- ── Backfill: drop the old reminder_sent_at usage gracefully ──────
-- We don't drop the column (cron still touches it during the rollover);
-- the new dispatcher uses notification_events as source of truth.

-- ── Reusable view: notifications + ride context for the inbox UI ──
create or replace view public.notification_inbox as
  select
    e.id,
    e.kind,
    e.status,
    e.scheduled_for,
    e.sent_at,
    e.created_at,
    e.attempts,
    e.last_error,
    e.recipients,
    e.payload,
    e.ride_id,
    r.passenger_name,
    r.pickup_at,
    r.pickup_address,
    r.dropoff_address
  from public.notification_events e
  left join public.rides r on r.id = e.ride_id;

grant select on public.notification_inbox to authenticated;
