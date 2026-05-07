-- Run AFTER previous migrations, one time, in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Adds:
--   1. clients.profile_id to link a client account to an auth user.
--   2. claim_client_by_email() RPC — first-login linker (mirror of
--      claim_driver_by_email).
--   3. RLS so clients see only their own rides.
--   4. submit_booking_request() RPC — anyone can call this from the
--      public /book page; creates a ride row with status='requested',
--      no auth needed.

-- ── Schema ────────────────────────────────────────────────────────
alter table public.clients
  add column if not exists profile_id uuid
    references public.profiles(id) on delete set null;
create index if not exists clients_profile_id_idx
  on public.clients (profile_id);

-- ── Helper functions ─────────────────────────────────────────────
create or replace function public.current_client_id()
returns uuid
language sql
security definer
stable
as $$
  select id from public.clients
  where profile_id = auth.uid()
  limit 1;
$$;

create or replace function public.claim_client_by_email()
returns public.clients
language plpgsql
security definer
set search_path = public
as $$
declare
  uemail text;
  c public.clients%rowtype;
begin
  select email into uemail from auth.users where id = auth.uid();
  if uemail is null then return null; end if;

  select * into c from public.clients
    where profile_id = auth.uid()
    limit 1;
  if found then return c; end if;

  update public.clients
    set profile_id = auth.uid()
    where lower(email) = lower(uemail)
      and profile_id is null
    returning * into c;
  return c;
end;
$$;
grant execute on function public.claim_client_by_email() to authenticated;

-- ── Public booking RPC ───────────────────────────────────────────
create or replace function public.submit_booking_request(
  p_passenger_name text,
  p_passenger_phone text,
  p_passenger_email text,
  p_pickup_at timestamptz,
  p_pickup_address text,
  p_dropoff_address text,
  p_trip_type text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_client_id uuid;
  new_ride_id uuid;
  combined_notes text;
begin
  if p_passenger_name is null or btrim(p_passenger_name) = '' then
    raise exception 'Name is required.';
  end if;
  if p_pickup_at is null then
    raise exception 'Pickup date/time is required.';
  end if;
  if p_pickup_address is null or btrim(p_pickup_address) = '' then
    raise exception 'Pickup address is required.';
  end if;

  -- Match an existing client by email if possible.
  if p_passenger_email is not null and btrim(p_passenger_email) <> '' then
    select id into matched_client_id
      from public.clients
      where lower(email) = lower(btrim(p_passenger_email))
      limit 1;
  end if;

  -- Build a notes blob that includes trip type + email if not linked.
  combined_notes := nullif(btrim(p_notes), '');
  if p_trip_type is not null and btrim(p_trip_type) <> '' then
    combined_notes :=
      'Trip type: ' || btrim(p_trip_type) ||
      coalesce(E'\n' || combined_notes, '');
  end if;
  if matched_client_id is null
     and p_passenger_email is not null
     and btrim(p_passenger_email) <> '' then
    combined_notes :=
      coalesce(combined_notes, '') ||
      coalesce(E'\nContact: ', E'Contact: ') ||
      btrim(p_passenger_email);
  end if;

  insert into public.rides (
    status, source, client_id,
    passenger_name, passenger_phone,
    pickup_at, pickup_address, dropoff_address, notes
  )
  values (
    'requested', 'booking_form', matched_client_id,
    btrim(p_passenger_name),
    nullif(btrim(p_passenger_phone), ''),
    p_pickup_at,
    btrim(p_pickup_address),
    nullif(btrim(p_dropoff_address), ''),
    combined_notes
  )
  returning id into new_ride_id;

  insert into public.events (ride_id, source, message)
  values (
    new_ride_id, 'booking',
    'New booking request from ' || btrim(p_passenger_name)
  );

  return new_ride_id;
end;
$$;
-- Anyone, including unauthenticated visitors on /book, can call this.
grant execute on function public.submit_booking_request(
  text, text, text, timestamptz, text, text, text, text
) to anon, authenticated;

-- ── RLS for client access ────────────────────────────────────────
-- Clients can read rides linked to their client_id.
drop policy if exists rides_client_read on public.rides;
create policy rides_client_read on public.rides
  for select using (client_id = public.current_client_id());

-- Clients can read their own client row.
drop policy if exists clients_self_read on public.clients;
create policy clients_self_read on public.clients
  for select using (profile_id = auth.uid());
