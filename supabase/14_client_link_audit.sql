-- Run AFTER 13_audit_security.sql in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Session 2 of the MCP audit/security work. Adds two RPCs that mirror
-- apply_ride_update_v1's transactional pattern:
--   1. apply_client_update_v1 — atomic UPDATE on clients + audit + events.
--      The Worker is responsible for computing the patch, including the
--      special address-history bookkeeping for home_address.
--   2. apply_ride_link_client_v1 — atomic re-link of a ride.client_id +
--      audit + events. Refuses to overwrite an existing client_id unless
--      p_force is true.

-- =====================================================================
-- 1. apply_client_update_v1
-- =====================================================================
-- Patch may contain any of:
--   name, phone, email, default_billing, home_address, status, notes,
--   previous_addresses
-- The Worker pre-appends `notes` and pre-builds `previous_addresses`
-- when home_address is changing.

create or replace function public.apply_client_update_v1(
  p_client_id uuid,
  p_patch jsonb,
  p_changed_fields text[],
  p_actor text,
  p_human_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row public.clients%rowtype;
  after_row public.clients%rowtype;
  audit_row_id uuid;
begin
  select * into before_row from public.clients
    where id = p_client_id
    for update;

  if not found then
    raise exception 'client_not_found' using errcode = 'P0001';
  end if;

  update public.clients set
    name               = case when p_patch ? 'name'               then p_patch->>'name'                                 else name end,
    phone              = case when p_patch ? 'phone'              then p_patch->>'phone'                                else phone end,
    email              = case when p_patch ? 'email'              then p_patch->>'email'                                else email end,
    default_billing    = case when p_patch ? 'default_billing'    then (p_patch->>'default_billing')::billing_terms     else default_billing end,
    home_address       = case when p_patch ? 'home_address'       then p_patch->>'home_address'                         else home_address end,
    previous_addresses = case when p_patch ? 'previous_addresses' then p_patch->>'previous_addresses'                   else previous_addresses end,
    status             = case when p_patch ? 'status'             then p_patch->>'status'                               else status end,
    notes              = case when p_patch ? 'notes'              then p_patch->>'notes'                                else notes end,
    updated_at         = now()
  where id = p_client_id
  returning * into after_row;

  insert into public.audit (
    entity_type, entity_id, action, changed_fields,
    before_json, after_json, actor
  )
  values (
    'client', p_client_id, 'update',
    coalesce(to_jsonb(p_changed_fields)::text, '[]'),
    to_jsonb(before_row)::text,
    to_jsonb(after_row)::text,
    p_actor
  )
  returning id into audit_row_id;

  if array_length(p_changed_fields, 1) is not null and p_human_message is not null then
    insert into public.events (ride_id, source, message, metadata)
    values (
      null, p_actor, p_human_message,
      jsonb_build_object(
        'audit_id', audit_row_id,
        'entity_type', 'client',
        'entity_id', p_client_id,
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

revoke all on function public.apply_client_update_v1(
  uuid, jsonb, text[], text, text
) from public, anon, authenticated;
-- Service role only.

-- =====================================================================
-- 2. apply_ride_link_client_v1
-- =====================================================================
-- Sets rides.client_id = p_client_id atomically with audit + events.
-- Validates that the client exists; refuses to overwrite an existing
-- non-null client_id unless p_force is true.

create or replace function public.apply_ride_link_client_v1(
  p_ride_id uuid,
  p_client_id uuid,
  p_actor text,
  p_human_message text,
  p_force boolean default false
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
  v_client_exists boolean;
  v_existing_name text;
begin
  -- Lock the ride row.
  select * into before_row from public.rides
    where id = p_ride_id
    for update;

  if not found then
    raise exception 'ride_not_found' using errcode = 'P0001';
  end if;

  -- Refuse to overwrite a real link without explicit force.
  if before_row.client_id is not null and not p_force then
    select name into v_existing_name from public.clients
      where id = before_row.client_id;
    raise exception
      'existing_client_id:%:%',
      before_row.client_id,
      coalesce(v_existing_name, '?')
      using errcode = 'P0003';
  end if;

  -- Verify the target client exists.
  select exists(select 1 from public.clients where id = p_client_id)
    into v_client_exists;
  if not v_client_exists then
    raise exception 'client_not_found' using errcode = 'P0004';
  end if;

  update public.rides
     set client_id  = p_client_id,
         updated_by = p_actor,
         updated_at = now()
   where id = p_ride_id
   returning * into after_row;

  insert into public.audit (
    entity_type, entity_id, action, changed_fields,
    before_json, after_json, actor
  )
  values (
    'ride', p_ride_id, 'link',
    to_jsonb(array['client_id'])::text,
    to_jsonb(before_row)::text,
    to_jsonb(after_row)::text,
    p_actor
  )
  returning id into audit_row_id;

  if p_human_message is not null then
    insert into public.events (ride_id, source, message, metadata)
    values (
      p_ride_id, p_actor, p_human_message,
      jsonb_build_object(
        'audit_id', audit_row_id,
        'changed_fields', array['client_id'],
        'force', p_force
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

revoke all on function public.apply_ride_link_client_v1(
  uuid, uuid, text, text, boolean
) from public, anon, authenticated;
-- Service role only.
