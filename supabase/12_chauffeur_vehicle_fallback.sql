-- Run AFTER previous migrations, one time, in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Tweaks get_my_ride_details so the chauffeur card on the rider app
-- shows the driver's default vehicle (drivers.default_vehicle_id) when
-- a specific vehicle hasn't been attached to the ride yet. Means clients
-- see "Hassan · Cadillac Escalade" instead of just "Hassan" when only
-- the chauffeur has been assigned.

create or replace function public.get_my_ride_details(p_ride_id uuid)
returns table (
  ride_id uuid,
  driver_full_name text,
  driver_phone text,
  vehicle_display_name text,
  vehicle_color text,
  vehicle_plate text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    r.id,
    d.full_name,
    d.phone,
    v.display_name,
    v.color,
    v.plate
  from public.rides r
  left join public.drivers d on d.id = r.driver_id
  -- Falls back to the driver's default car when no specific vehicle has
  -- been attached to the ride yet.
  left join public.vehicles v on v.id = coalesce(r.vehicle_id, d.default_vehicle_id)
  where r.id = p_ride_id
    and (
      public.is_owner()
      or r.driver_id = public.current_driver_id()
      or r.client_id = public.current_client_id()
    );
$$;

revoke all on function public.get_my_ride_details(uuid) from public;
grant execute on function public.get_my_ride_details(uuid) to authenticated;
