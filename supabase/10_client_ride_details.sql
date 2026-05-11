-- Run AFTER previous migrations, one time, in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Lets a signed-in client (or driver) see the driver name + vehicle
-- details for a ride they own, without granting them a SELECT policy
-- on the underlying drivers / vehicles tables. Used by the rider app
-- so the "your chauffeur" card can show Greg · Cadillac Escalade · 52777J3.

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
  left join public.vehicles v on v.id = r.vehicle_id
  where r.id = p_ride_id
    and (
      public.is_owner()
      or r.driver_id = public.current_driver_id()
      or r.client_id = public.current_client_id()
    );
$$;

revoke all on function public.get_my_ride_details(uuid) from public;
grant execute on function public.get_my_ride_details(uuid) to authenticated;
