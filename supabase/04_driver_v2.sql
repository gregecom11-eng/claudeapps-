-- Run AFTER previous migrations, one time, in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Adds:
--   1. Two new ride_status values: 'on_the_way' and 'arrived'.
--      Final flow:
--        requested → scheduled → on_the_way → arrived → in_progress → completed
--        (cancelled at any point)
--   2. ride_extras table — line items added during/after a ride
--      (extra stop, wait time, additional service). Both owner and the
--      assigned driver can add them; only owner can delete.

-- ── Status enum ────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'on_the_way'
      and enumtypid = (select oid from pg_type where typname = 'ride_status')
  ) then
    alter type ride_status add value 'on_the_way' after 'scheduled';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'arrived'
      and enumtypid = (select oid from pg_type where typname = 'ride_status')
  ) then
    alter type ride_status add value 'arrived' after 'on_the_way';
  end if;
end $$;

-- ── Ride extras table ─────────────────────────────────────────────
create table if not exists public.ride_extras (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  description text not null,
  amount_cents int default 0,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz default now()
);
create index if not exists ride_extras_ride_id_idx
  on public.ride_extras (ride_id);

alter table public.ride_extras enable row level security;

drop policy if exists ride_extras_owner_all on public.ride_extras;
create policy ride_extras_owner_all on public.ride_extras
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists ride_extras_driver_read on public.ride_extras;
create policy ride_extras_driver_read on public.ride_extras
  for select using (
    exists (
      select 1 from public.rides r
      where r.id = ride_extras.ride_id
        and r.driver_id = public.current_driver_id()
    )
  );

drop policy if exists ride_extras_driver_insert on public.ride_extras;
create policy ride_extras_driver_insert on public.ride_extras
  for insert with check (
    exists (
      select 1 from public.rides r
      where r.id = ride_id
        and r.driver_id = public.current_driver_id()
    )
  );

-- (drivers cannot UPDATE or DELETE extras — only the owner audits/adjusts)

-- ── Activity log: log status changes for new statuses too ─────────
-- (the existing trigger already handles 'new.status is distinct from
--  old.status', so no change needed)
