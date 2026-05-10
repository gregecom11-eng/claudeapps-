-- Run AFTER previous migrations, one time, in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Adds three driver-self-service columns:
--   * available         — driver-controlled "ready for new rides" flag.
--                         Owner sees it in dispatch; driver toggles it
--                         from their Profile.
--   * default_vehicle_id — preferred vehicle. Dispatch can pre-select it
--                         when creating a new ride.
--   * last_seen_at      — bumped by the driver app on Today-screen load
--                         so the owner can tell at a glance whether the
--                         driver app is actively running.
--
-- All three are exposed via a security-definer RPC `update_my_driver_self`
-- (drivers can't UPDATE the drivers table directly under RLS), and a
-- companion `mark_driver_seen` for the cheap heartbeat path.

alter table public.drivers
  add column if not exists available boolean default true;

alter table public.drivers
  add column if not exists default_vehicle_id uuid
    references public.vehicles(id) on delete set null;

alter table public.drivers
  add column if not exists last_seen_at timestamptz;

-- ── Driver self-service RPCs ──────────────────────────────────────

create or replace function public.update_my_driver_self(
  p_available boolean default null,
  p_default_vehicle_id uuid default null
)
returns public.drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.drivers%rowtype;
begin
  update public.drivers
    set
      available = coalesce(p_available, available),
      default_vehicle_id = coalesce(p_default_vehicle_id, default_vehicle_id)
    where profile_id = auth.uid()
    returning * into d;
  return d;
end;
$$;

grant execute on function public.update_my_driver_self(boolean, uuid)
  to authenticated;

-- "Clear default vehicle" path — coalesce above can't distinguish
-- "leave alone" from "set to null", so we expose a tiny dedicated RPC.
create or replace function public.clear_my_default_vehicle()
returns public.drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.drivers%rowtype;
begin
  update public.drivers
    set default_vehicle_id = null
    where profile_id = auth.uid()
    returning * into d;
  return d;
end;
$$;

grant execute on function public.clear_my_default_vehicle()
  to authenticated;

create or replace function public.mark_driver_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.drivers
    set last_seen_at = now()
    where profile_id = auth.uid();
end;
$$;

grant execute on function public.mark_driver_seen() to authenticated;
