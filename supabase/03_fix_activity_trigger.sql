-- Run AFTER schema.sql, one time, in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Why: the rides → events activity-log trigger writes to events on every
-- ride status change. Drivers don't have INSERT permission on events
-- (RLS only grants them SELECT), so when a driver marks a ride
-- "in_progress" the trigger's INSERT into events fails RLS, which rolls
-- back the whole UPDATE. Silently. The driver app sees "success" with no
-- rows changed.
--
-- Fix: run the trigger function as SECURITY DEFINER so it executes with
-- the privileges of its owner (postgres / service_role) and is not
-- subject to the caller's RLS. The trigger itself is still gated by the
-- ride UPDATE — drivers can only fire it for their own assigned rides.

create or replace function public.log_ride_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.events (ride_id, source, message, metadata)
    values (new.id, 'system',
      'Ride created: ' || new.passenger_name,
      jsonb_build_object('status', new.status));
  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.events (ride_id, source, message, metadata)
    values (new.id, 'system',
      'Ride ' || new.passenger_name || ' → ' || new.status,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;
