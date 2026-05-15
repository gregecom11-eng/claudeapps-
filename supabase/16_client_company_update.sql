-- Run AFTER 15_driver_audit.sql in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Session 4: extends apply_client_update_v1 to also update `company`.
-- The clients table already has the column (from schema.sql); only the
-- RPC was missing it.

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
    company            = case when p_patch ? 'company'            then p_patch->>'company'                              else company end,
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
