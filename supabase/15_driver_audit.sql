-- Run AFTER 14_client_link_audit.sql in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Session 3 of the MCP audit/security work. Adds two RPCs mirroring
-- apply_ride_update_v1's transactional pattern, but for drivers:
--   1. apply_driver_create_v1 — atomic INSERT + audit + events.
--      The Worker pre-checks for duplicates (case-insensitive,
--      whitespace-normalized) so this function is only called when
--      the row is known-new.
--   2. apply_driver_update_v1 — atomic UPDATE + audit + events.

-- =====================================================================
-- 1. apply_driver_create_v1
-- =====================================================================
-- Patch may contain:
--   full_name (required), phone, email, default_split, vehicle_name,
--   status, notes
-- `active` is kept in sync with `status` so existing lookups that
-- filter by `active = true` continue to work.

create or replace function public.apply_driver_create_v1(
  p_patch jsonb,
  p_actor text,
  p_human_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_row public.drivers%rowtype;
  audit_row_id uuid;
  v_status text;
begin
  v_status := coalesce(p_patch->>'status', 'active');

  insert into public.drivers (
    full_name, phone, email, default_split, vehicle_name,
    status, notes, active
  )
  values (
    p_patch->>'full_name',
    nullif(p_patch->>'phone', ''),
    nullif(p_patch->>'email', ''),
    nullif(p_patch->>'default_split', '')::real,
    nullif(p_patch->>'vehicle_name', ''),
    v_status,
    nullif(p_patch->>'notes', ''),
    v_status = 'active'
  )
  returning * into new_row;

  insert into public.audit (
    entity_type, entity_id, action, changed_fields,
    before_json, after_json, actor
  )
  values (
    'driver', new_row.id, 'create',
    to_jsonb(array['full_name','phone','email','default_split','vehicle_name','status','notes'])::text,
    null,
    to_jsonb(new_row)::text,
    p_actor
  )
  returning id into audit_row_id;

  if p_human_message is not null then
    insert into public.events (ride_id, source, message, metadata)
    values (
      null, p_actor, p_human_message,
      jsonb_build_object(
        'audit_id', audit_row_id,
        'entity_type', 'driver',
        'entity_id', new_row.id,
        'action', 'create'
      )
    );
  end if;

  return jsonb_build_object(
    'driver', to_jsonb(new_row),
    'audit_id', audit_row_id
  );
end;
$$;

revoke all on function public.apply_driver_create_v1(jsonb, text, text)
  from public, anon, authenticated;
-- Service role only.

-- =====================================================================
-- 2. apply_driver_update_v1
-- =====================================================================
-- Patch may contain any of the same fields above (except full_name is
-- editable but rare). Worker pre-appends `notes`. `active` is kept in
-- sync with `status` when status is in the patch.

create or replace function public.apply_driver_update_v1(
  p_driver_id uuid,
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
  before_row public.drivers%rowtype;
  after_row public.drivers%rowtype;
  audit_row_id uuid;
begin
  select * into before_row from public.drivers
    where id = p_driver_id
    for update;

  if not found then
    raise exception 'driver_not_found' using errcode = 'P0001';
  end if;

  update public.drivers set
    full_name     = case when p_patch ? 'full_name'     then p_patch->>'full_name'                     else full_name end,
    phone         = case when p_patch ? 'phone'         then p_patch->>'phone'                         else phone end,
    email         = case when p_patch ? 'email'         then p_patch->>'email'                         else email end,
    default_split = case when p_patch ? 'default_split' then (p_patch->>'default_split')::real        else default_split end,
    vehicle_name  = case when p_patch ? 'vehicle_name'  then p_patch->>'vehicle_name'                  else vehicle_name end,
    status        = case when p_patch ? 'status'        then p_patch->>'status'                        else status end,
    active        = case when p_patch ? 'status'        then (p_patch->>'status') = 'active'           else active end,
    notes         = case when p_patch ? 'notes'         then p_patch->>'notes'                         else notes end
  where id = p_driver_id
  returning * into after_row;

  insert into public.audit (
    entity_type, entity_id, action, changed_fields,
    before_json, after_json, actor
  )
  values (
    'driver', p_driver_id, 'update',
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
        'entity_type', 'driver',
        'entity_id', p_driver_id,
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

revoke all on function public.apply_driver_update_v1(
  uuid, jsonb, text[], text, text
) from public, anon, authenticated;
-- Service role only.
