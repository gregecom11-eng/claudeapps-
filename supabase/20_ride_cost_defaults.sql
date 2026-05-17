-- Run AFTER 19_auto_invoice.sql in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Session 7b: per-trip-type default cost templates.
--
-- The operator sets one default-cents number per (trip type ×
-- category). When a new ride is inserted, the trigger infers the
-- trip type from the ride's fields and seeds matching ride_costs
-- rows so the owner doesn't have to add gas/tolls/parking by hand
-- every time. Defaults of 0 are skipped (no row created).
--
-- Trip type inference (matches src/lib/earnings.ts):
--   flight_* set      → 'airport'
--   has dropoff       → 'p2p'
--   neither           → 'hourly'
--
-- Categories: must match the ride_costs CHECK constraint
--   (gas, tolls, parking, amenities, tip_out, other).

alter table public.org_settings
  add column if not exists ride_cost_defaults jsonb default '{
    "airport": {"gas": 0, "tolls": 0, "parking": 0, "amenities": 0},
    "p2p":     {"gas": 0, "tolls": 0, "parking": 0, "amenities": 0},
    "hourly":  {"gas": 0, "tolls": 0, "parking": 0, "amenities": 0}
  }'::jsonb;

-- Make sure the singleton row has the JSON populated (no-op if it
-- was inserted before this migration).
update public.org_settings
   set ride_cost_defaults = '{
     "airport": {"gas": 0, "tolls": 0, "parking": 0, "amenities": 0},
     "p2p":     {"gas": 0, "tolls": 0, "parking": 0, "amenities": 0},
     "hourly":  {"gas": 0, "tolls": 0, "parking": 0, "amenities": 0}
   }'::jsonb
 where id = 1 and ride_cost_defaults is null;

create or replace function public.apply_ride_cost_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  defaults jsonb;
  per_type jsonb;
  trip_type text;
  cat text;
  amt int;
begin
  select ride_cost_defaults into defaults
    from public.org_settings where id = 1;
  if defaults is null then return new; end if;

  if new.flight_number is not null
     or new.flight_airport is not null then
    trip_type := 'airport';
  elsif new.dropoff_address is not null
        and length(trim(new.dropoff_address)) > 0 then
    trip_type := 'p2p';
  else
    trip_type := 'hourly';
  end if;

  per_type := defaults->trip_type;
  if per_type is null then return new; end if;

  for cat in select jsonb_object_keys(per_type) loop
    amt := coalesce((per_type->>cat)::int, 0);
    if amt > 0 then
      -- Don't double-insert if a row for this (ride, category) already
      -- exists (e.g., the booking flow added a custom one ahead of us).
      if not exists (
        select 1 from public.ride_costs
        where ride_id = new.id and category = cat
      ) then
        insert into public.ride_costs (ride_id, category, estimated_cents)
        values (new.id, cat, amt);
      end if;
    end if;
  end loop;

  return new;
exception when others then
  raise warning 'apply_ride_cost_defaults: %', sqlerrm;
  return new;
end $$;

drop trigger if exists rides_apply_cost_defaults on public.rides;
create trigger rides_apply_cost_defaults
  after insert on public.rides
  for each row execute function public.apply_ride_cost_defaults();
