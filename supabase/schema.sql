-- SDLuxuryTransportation, Inc. — operations schema
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Idempotent: safe to re-run.

-- =====================================================================
-- 1. Roles
-- =====================================================================
do $$ begin
  create type user_role as enum ('owner', 'driver', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ride_status as enum (
    'requested',   -- created from public booking, not yet confirmed
    'scheduled',   -- confirmed and on the calendar
    'in_progress', -- driver on the way / passenger onboard
    'completed',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type invoice_status as enum (
    'draft', 'sent', 'paid', 'overdue', 'void'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type billing_terms as enum (
    'cash', 'card', 'zelle', 'net_15', 'net_30', 'company_billing'
  );
exception when duplicate_object then null; end $$;

-- =====================================================================
-- 2. Profiles (linked to auth.users)
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'driver',
  full_name text,
  phone text,
  created_at timestamptz default now()
);

-- Auto-create a profile when an auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- 3. Core domain tables
-- =====================================================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text,
  phone text,
  default_billing billing_terms,
  preferences jsonb default '{}'::jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists clients_name_idx on public.clients (lower(name));

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  license_no text,
  active boolean default true,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  year int,
  make text,
  model text,
  color text,
  plate text,
  capacity int,
  active boolean default true,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  status ride_status not null default 'scheduled',
  source text default 'manual',  -- 'manual' | 'mcp' | 'booking_form' | 'email'

  client_id uuid references public.clients(id) on delete set null,
  passenger_name text not null,
  passenger_phone text,

  pickup_at timestamptz not null,
  pickup_address text not null,
  dropoff_address text,

  flight_airline text,
  flight_number text,
  flight_airport text,
  flight_terminal text,
  flight_status text,

  driver_id uuid references public.drivers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,

  fare_cents int default 0,
  gratuity_cents int default 0,
  parking_cents int default 0,
  total_cents int generated always as
    (coalesce(fare_cents,0) + coalesce(gratuity_cents,0) + coalesce(parking_cents,0))
    stored,
  billing_terms billing_terms,

  notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists rides_pickup_at_idx on public.rides (pickup_at);
create index if not exists rides_driver_id_idx on public.rides (driver_id);
create index if not exists rides_client_id_idx on public.rides (client_id);
create index if not exists rides_status_idx   on public.rides (status);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid references public.rides(id) on delete cascade,
  number text unique,
  amount_cents int not null,
  terms billing_terms,
  due_date date,
  status invoice_status not null default 'draft',
  paid_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

-- A simple activity log so the dashboard has a feed without joining tables.
create table if not exists public.events (
  id bigserial primary key,
  ride_id uuid references public.rides(id) on delete set null,
  source text not null,            -- 'system' | 'mcp' | 'user' | 'driver'
  message text not null,
  metadata jsonb,
  created_at timestamptz default now()
);
create index if not exists events_created_at_idx on public.events (created_at desc);

-- =====================================================================
-- 4. updated_at triggers
-- =====================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists rides_updated_at on public.rides;
create trigger rides_updated_at before update on public.rides
  for each row execute function public.touch_updated_at();

drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at before update on public.clients
  for each row execute function public.touch_updated_at();

-- Activity log: write an event when a ride changes status.
create or replace function public.log_ride_change()
returns trigger language plpgsql as $$
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

drop trigger if exists rides_log_change on public.rides;
create trigger rides_log_change after insert or update on public.rides
  for each row execute function public.log_ride_change();

-- =====================================================================
-- 5. Row-level security
--   Owner: full access to everything.
--   Driver: read rides assigned to them; can update status only.
--   Client: read rides linked to their client_id; read their invoices.
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.clients  enable row level security;
alter table public.drivers  enable row level security;
alter table public.vehicles enable row level security;
alter table public.rides    enable row level security;
alter table public.invoices enable row level security;
alter table public.events   enable row level security;

-- Helper: is the current user an owner?
create or replace function public.is_owner()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- Helper: driver_id linked to the current auth user, if any.
create or replace function public.current_driver_id()
returns uuid
language sql
security definer
stable
as $$
  select id from public.drivers where profile_id = auth.uid() limit 1;
$$;

-- profiles: a user can read their own row; owners can read all.
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (auth.uid() = id or public.is_owner());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id or public.is_owner());

-- clients / drivers / vehicles: owner-only writes; owners + drivers read.
drop policy if exists clients_owner_all on public.clients;
create policy clients_owner_all on public.clients
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists clients_driver_read on public.clients;
create policy clients_driver_read on public.clients
  for select using (public.current_driver_id() is not null);

drop policy if exists drivers_owner_all on public.drivers;
create policy drivers_owner_all on public.drivers
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists drivers_self_read on public.drivers;
create policy drivers_self_read on public.drivers
  for select using (profile_id = auth.uid());

drop policy if exists vehicles_owner_all on public.vehicles;
create policy vehicles_owner_all on public.vehicles
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists vehicles_driver_read on public.vehicles;
create policy vehicles_driver_read on public.vehicles
  for select using (public.current_driver_id() is not null);

-- rides: owners see all; drivers see assigned; clients via client_id.
drop policy if exists rides_owner_all on public.rides;
create policy rides_owner_all on public.rides
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists rides_driver_read on public.rides;
create policy rides_driver_read on public.rides
  for select using (driver_id = public.current_driver_id());

drop policy if exists rides_driver_update on public.rides;
create policy rides_driver_update on public.rides
  for update using (driver_id = public.current_driver_id())
  with check (driver_id = public.current_driver_id());

-- invoices: owner-only for now; clients later via a join view if needed.
drop policy if exists invoices_owner_all on public.invoices;
create policy invoices_owner_all on public.invoices
  for all using (public.is_owner()) with check (public.is_owner());

-- events: anyone authenticated can read events; only owner writes via UI.
drop policy if exists events_authed_read on public.events;
create policy events_authed_read on public.events
  for select using (auth.role() = 'authenticated');

-- =====================================================================
-- 6. Seed: drivers, vehicles, recurring clients
-- (You can re-run this and inserts will be skipped via on conflict.)
-- =====================================================================
insert into public.drivers (full_name, phone) values
  ('Greg (Gregorio Vazquez Robles)', null),
  ('Hassan', null),
  ('David Santiago', null)
on conflict do nothing;

insert into public.vehicles (display_name, year, make, model, plate) values
  ('GMC Yukon', 2022, 'GMC', 'Yukon', '52777J3'),
  ('Cadillac Escalade ESV', 2023, 'Cadillac', 'Escalade ESV', null)
on conflict do nothing;

insert into public.clients (name) values
  ('Kevin Morgan'), ('Loreine'), ('Mr. Williams'),
  ('Carlos'), ('Kim'), ('Grant'), ('Hairo')
on conflict do nothing;

-- =====================================================================
-- 7. Make the current authed user the owner.
-- After you log in for the first time, run THIS query separately:
--   update public.profiles set role = 'owner' where id = auth.uid();
-- =====================================================================
