-- Run AFTER 17_owner_commission.sql in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Session 6: expenses + profitability tracking.
--
-- Three tables, each answering a different "where does the money go?"
-- question:
--
--   expenses_fixed       — recurring company costs (insurance, lease,
--                          phone, software, rent). Allocate per-day to
--                          a window based on cadence.
--   ride_costs           — per-ride variable costs (gas, tolls, parking,
--                          amenities, tip-out, other). Two amounts per
--                          row: estimated_cents (set up-front) and
--                          actual_cents (filled in after the ride).
--   vehicle_maintenance  — one-time service costs (oil, tires, brakes,
--                          detailing, registration, smog). Amortize
--                          over service_interval_days when set so the
--                          cost spreads across the period it covers.
--
-- Owner manages all three. For ride_costs, the driver assigned to a
-- ride can read + insert + update costs on that ride (so the driver can
-- confirm "actual" amounts after the trip).
--
-- No SECURITY DEFINER RPCs or audit rows in this pass — these tables
-- aren't customer-facing PII like rides/clients are, and writes are
-- low-volume. Add audit later if/when expenses become a compliance
-- concern.

-- ── expenses_fixed ──────────────────────────────────────────────
create table if not exists public.expenses_fixed (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'insurance', 'lease', 'phone', 'software', 'rent',
    'subscription', 'other'
  )),
  label text not null,
  amount_cents integer not null check (amount_cents >= 0),
  cadence text not null default 'monthly' check (cadence in (
    'weekly', 'monthly', 'annual'
  )),
  effective_from date not null default current_date,
  effective_to date, -- null = still active
  vehicle_id uuid references public.vehicles(id) on delete set null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists expenses_fixed_effective_from_idx
  on public.expenses_fixed (effective_from);
create index if not exists expenses_fixed_effective_to_idx
  on public.expenses_fixed (effective_to)
  where effective_to is not null;

drop trigger if exists expenses_fixed_updated_at on public.expenses_fixed;
create trigger expenses_fixed_updated_at before update on public.expenses_fixed
  for each row execute function public.touch_updated_at();

-- ── ride_costs ──────────────────────────────────────────────────
create table if not exists public.ride_costs (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  category text not null check (category in (
    'gas', 'tolls', 'parking', 'amenities', 'tip_out', 'other'
  )),
  estimated_cents integer not null default 0
    check (estimated_cents >= 0),
  actual_cents integer
    check (actual_cents is null or actual_cents >= 0),
  note text,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz default now(),
  confirmed_at timestamptz
);
create index if not exists ride_costs_ride_id_idx
  on public.ride_costs (ride_id);
create index if not exists ride_costs_category_idx
  on public.ride_costs (category);

-- ── vehicle_maintenance ─────────────────────────────────────────
create table if not exists public.vehicle_maintenance (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  category text not null check (category in (
    'oil', 'tires', 'brakes', 'detailing', 'registration',
    'smog', 'repair', 'other'
  )),
  label text not null,
  amount_cents integer not null check (amount_cents >= 0),
  serviced_at date not null default current_date,
  odometer_at_service integer
    check (odometer_at_service is null or odometer_at_service >= 0),
  service_interval_days integer
    check (service_interval_days is null or service_interval_days > 0),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists vehicle_maintenance_vehicle_id_idx
  on public.vehicle_maintenance (vehicle_id);
create index if not exists vehicle_maintenance_serviced_at_idx
  on public.vehicle_maintenance (serviced_at desc);

drop trigger if exists vehicle_maintenance_updated_at on public.vehicle_maintenance;
create trigger vehicle_maintenance_updated_at before update on public.vehicle_maintenance
  for each row execute function public.touch_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────
alter table public.expenses_fixed       enable row level security;
alter table public.ride_costs           enable row level security;
alter table public.vehicle_maintenance  enable row level security;

-- Owner manages every expense row.
drop policy if exists expenses_fixed_owner_all on public.expenses_fixed;
create policy expenses_fixed_owner_all on public.expenses_fixed
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists vehicle_maintenance_owner_all on public.vehicle_maintenance;
create policy vehicle_maintenance_owner_all on public.vehicle_maintenance
  for all using (public.is_owner()) with check (public.is_owner());

-- ride_costs: owner full access; assigned driver can read + insert +
-- update costs on rides they're driving (so they can confirm "actual"
-- amounts after the trip). Only the owner can delete.
drop policy if exists ride_costs_owner_all on public.ride_costs;
create policy ride_costs_owner_all on public.ride_costs
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists ride_costs_driver_read on public.ride_costs;
create policy ride_costs_driver_read on public.ride_costs
  for select using (
    exists (
      select 1 from public.rides r
      where r.id = ride_costs.ride_id
        and r.driver_id = public.current_driver_id()
    )
  );

drop policy if exists ride_costs_driver_insert on public.ride_costs;
create policy ride_costs_driver_insert on public.ride_costs
  for insert with check (
    exists (
      select 1 from public.rides r
      where r.id = ride_id
        and r.driver_id = public.current_driver_id()
    )
  );

drop policy if exists ride_costs_driver_update on public.ride_costs;
create policy ride_costs_driver_update on public.ride_costs
  for update using (
    exists (
      select 1 from public.rides r
      where r.id = ride_costs.ride_id
        and r.driver_id = public.current_driver_id()
    )
  ) with check (
    exists (
      select 1 from public.rides r
      where r.id = ride_costs.ride_id
        and r.driver_id = public.current_driver_id()
    )
  );

-- (no driver delete — only owner audits/adjusts deletions)
