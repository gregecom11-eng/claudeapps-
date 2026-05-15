-- Run AFTER previous migrations, one time, in Supabase → SQL Editor.
-- Idempotent: safe to re-run on a database with existing data.
--
-- This migration introduces:
--   1. New columns on clients / drivers / rides to track richer per-row state.
--   2. An `audit` table (the canonical record of every write touching
--      ride / client / driver rows). The dashboard activity feed
--      (`events`) keeps PII-redacted human-readable entries; this table
--      keeps the full pre/post JSON for forensics.
--   3. A `mcp_rate_limits` table + `check_and_increment_rate_limit` RPC
--      so the Worker can enforce per-actor rate limits in one round trip.
--   4. An `apply_ride_update_v1` RPC that wraps an UPDATE on rides plus
--      the audit + events inserts in a single transaction (so a partial
--      write can never leave the audit log inconsistent with reality).

-- =====================================================================
-- 1. Column additions
-- =====================================================================

-- clients
alter table public.clients
  add column if not exists home_address text;
alter table public.clients
  add column if not exists previous_addresses text default '[]';
alter table public.clients
  add column if not exists status text default 'active';
-- clients.notes already exists from schema.sql — left alone.

-- drivers
alter table public.drivers
  add column if not exists default_split real;
alter table public.drivers
  add column if not exists vehicle_name text;
alter table public.drivers
  add column if not exists status text default 'active';
-- drivers.email and drivers.notes already exist — left alone.

-- rides
alter table public.rides
  add column if not exists updated_by text;

-- =====================================================================
-- 2. Audit table
-- =====================================================================
create table if not exists public.audit (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,          -- 'ride' | 'client' | 'driver'
  entity_id uuid not null,
  action text not null,               -- 'update' | 'create' | 'link'
  changed_fields text not null default '[]',  -- JSON array of field names
  before_json text,                   -- full pre-change row snapshot (JSON)
  after_json text,                    -- full post-change row snapshot (JSON)
  actor text not null,                -- e.g. 'mcp:claude'
  created_at timestamptz not null default now()
);
create index if not exists audit_entity_idx
  on public.audit (entity_type, entity_id, created_at desc);
create index if not exists audit_created_at_idx
  on public.audit (created_at desc);
create index if not exists audit_actor_idx
  on public.audit (actor, created_at desc);

alter table public.audit enable row level security;

-- Only owners read the audit table. The Worker bypasses RLS via the
-- service-role key, which is how all writes happen.
drop policy if exists audit_owner_read on public.audit;
create policy audit_owner_read on public.audit
  for select using (public.is_owner());

-- =====================================================================
-- 3. Rate-limit table + RPC
-- =====================================================================
create table if not exists public.mcp_rate_limits (
  actor text not null,
  minute_bucket timestamptz not null,
  count int not null default 0,
  primary key (actor, minute_bucket)
);
create index if not exists mcp_rate_limits_actor_minute_bucket_idx
  on public.mcp_rate_limits (actor, minute_bucket desc);

alter table public.mcp_rate_limits enable row level security;
-- No policies → no client-side access. The Worker uses the service role.

-- Limits: 100/min, 2000/hr per actor.
create or replace function public.check_and_increment_rate_limit(
  p_actor text,
  p_limit_minute int default 100,
  p_limit_hour int default 2000
)
returns table (
  allowed boolean,
  reason text,
  minute_count int,
  hour_count int,
  retry_after_seconds int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := now();
  this_minute timestamptz := date_trunc('minute', now_ts);
  hour_ago timestamptz := now_ts - interval '1 hour';
  v_minute_count int;
  v_hour_count int;
  v_retry int;
begin
  insert into public.mcp_rate_limits (actor, minute_bucket, count)
    values (p_actor, this_minute, 1)
    on conflict (actor, minute_bucket)
    do update set count = mcp_rate_limits.count + 1
    returning mcp_rate_limits.count into v_minute_count;

  select coalesce(sum(c.count), 0)::int into v_hour_count
    from public.mcp_rate_limits c
    where c.actor = p_actor
      and c.minute_bucket > hour_ago;

  -- Occasional cleanup. Cheap: ~1% of calls do the prune.
  if random() < 0.01 then
    delete from public.mcp_rate_limits
      where minute_bucket < now_ts - interval '2 hours';
  end if;

  if v_minute_count > p_limit_minute then
    v_retry := 60 - extract(second from now_ts)::int;
    return query select false, 'per-minute limit exceeded'::text,
      v_minute_count, v_hour_count, v_retry;
  elsif v_hour_count > p_limit_hour then
    v_retry := 3600 - extract(second from (now_ts - hour_ago))::int;
    return query select false, 'per-hour limit exceeded'::text,
      v_minute_count, v_hour_count, v_retry;
  else
    return query select true, null::text, v_minute_count, v_hour_count, 0;
  end if;
end;
$$;

revoke all on function public.check_and_increment_rate_limit(text, int, int)
  from public, anon, authenticated;
-- Service role only.

-- =====================================================================
-- 4. apply_ride_update_v1 — atomic UPDATE + audit + events
-- =====================================================================
-- All update_ride writes go through this function so the row update,
-- audit row, and activity-feed event are written together in one
-- transaction. The Worker computes:
--   * the patch (only fields the caller actually passed)
--   * the changed_fields list (excludes no-ops)
--   * the human-readable activity message (with PII redacted)
-- and passes them here. The function:
--   * locks the ride row, returns full before/after,
--   * applies each field if present in p_patch (jsonb),
--   * inserts audit row (entity_type='ride'),
--   * inserts events row (the dashboard activity feed),
--   * returns { before, after, audit_id }.

create or replace function public.apply_ride_update_v1(
  p_ride_id uuid,
  p_patch jsonb,
  p_changed_fields text[],
  p_actor text,
  p_human_message text,
  p_allow_finalized boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row public.rides%rowtype;
  after_row public.rides%rowtype;
  audit_row_id uuid;
begin
  -- Lock the row so concurrent updates serialize.
  select * into before_row from public.rides
    where id = p_ride_id
    for update;

  if not found then
    raise exception 'ride_not_found' using errcode = 'P0001';
  end if;

  if before_row.status in ('completed', 'cancelled') and not p_allow_finalized then
    raise exception 'finalized_ride' using errcode = 'P0002';
  end if;

  -- Apply patch. Only fields present in p_patch are touched (we use
  -- `?` jsonb operator so an explicit null in the patch DOES clear,
  -- but absence leaves the column untouched). The `notes` field
  -- arrives pre-appended from the Worker.
  update public.rides set
    pickup_at        = case when p_patch ? 'pickup_at'        then (p_patch->>'pickup_at')::timestamptz       else pickup_at end,
    pickup_address   = case when p_patch ? 'pickup_address'   then p_patch->>'pickup_address'                 else pickup_address end,
    dropoff_address  = case when p_patch ? 'dropoff_address'  then p_patch->>'dropoff_address'                else dropoff_address end,
    fare_cents       = case when p_patch ? 'fare_cents'       then (p_patch->>'fare_cents')::int             else fare_cents end,
    gratuity_cents   = case when p_patch ? 'gratuity_cents'   then (p_patch->>'gratuity_cents')::int         else gratuity_cents end,
    parking_cents    = case when p_patch ? 'parking_cents'    then (p_patch->>'parking_cents')::int          else parking_cents end,
    driver_id        = case when p_patch ? 'driver_id'        then nullif(p_patch->>'driver_id','')::uuid    else driver_id end,
    vehicle_id       = case when p_patch ? 'vehicle_id'       then nullif(p_patch->>'vehicle_id','')::uuid   else vehicle_id end,
    flight_airline   = case when p_patch ? 'flight_airline'   then p_patch->>'flight_airline'                else flight_airline end,
    flight_number    = case when p_patch ? 'flight_number'    then p_patch->>'flight_number'                 else flight_number end,
    flight_airport   = case when p_patch ? 'flight_airport'   then p_patch->>'flight_airport'                else flight_airport end,
    flight_terminal  = case when p_patch ? 'flight_terminal'  then p_patch->>'flight_terminal'               else flight_terminal end,
    billing_terms    = case when p_patch ? 'billing_terms'    then (p_patch->>'billing_terms')::billing_terms else billing_terms end,
    passenger_phone  = case when p_patch ? 'passenger_phone'  then p_patch->>'passenger_phone'               else passenger_phone end,
    passenger_name   = case when p_patch ? 'passenger_name'   then p_patch->>'passenger_name'                else passenger_name end,
    notes            = case when p_patch ? 'notes'            then p_patch->>'notes'                          else notes end,
    updated_by       = p_actor,
    updated_at       = now()
  where id = p_ride_id
  returning * into after_row;

  insert into public.audit (
    entity_type, entity_id, action, changed_fields,
    before_json, after_json, actor
  )
  values (
    'ride', p_ride_id, 'update',
    coalesce(to_jsonb(p_changed_fields)::text, '[]'),
    to_jsonb(before_row)::text,
    to_jsonb(after_row)::text,
    p_actor
  )
  returning id into audit_row_id;

  if array_length(p_changed_fields, 1) is not null and p_human_message is not null then
    insert into public.events (ride_id, source, message, metadata)
    values (
      p_ride_id, p_actor, p_human_message,
      jsonb_build_object(
        'audit_id', audit_row_id,
        'changed_fields', p_changed_fields
      )
    );
  end if;

  return jsonb_build_object(
    'before', to_jsonb(before_row),
    'after', to_jsonb(after_row),
    'audit_id', audit_row_id
  );
end;
$$;

revoke all on function public.apply_ride_update_v1(
  uuid, jsonb, text[], text, text, boolean
) from public, anon, authenticated;
-- Service role only.
