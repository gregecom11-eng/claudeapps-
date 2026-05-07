-- Run AFTER previous migrations, one time, in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Adds:
--   1. Auto-role-promotion: claim_driver_by_email and claim_client_by_email
--      now also set profiles.role to 'driver' / 'client' on first link, so
--      no manual UPDATE-profiles SQL is required to give a new driver or
--      client portal access.
--   2. org_settings table — single-row table for company-wide settings
--      (dispatch phone, brand). All authenticated users can read; only
--      owners can write.
--   3. simple invoice numbering helper.

-- ── Updated claim_driver_by_email ─────────────────────────────────
create or replace function public.claim_driver_by_email()
returns public.drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  uemail text;
  d public.drivers%rowtype;
begin
  select email into uemail from auth.users where id = auth.uid();
  if uemail is null then return null; end if;

  select * into d from public.drivers where profile_id = auth.uid() limit 1;
  if found then
    -- Make sure their profile role reflects 'driver'.
    update public.profiles set role = 'driver'
      where id = auth.uid() and role <> 'owner' and role <> 'driver';
    return d;
  end if;

  update public.drivers
    set profile_id = auth.uid()
    where lower(email) = lower(uemail)
      and profile_id is null
    returning * into d;

  if found then
    update public.profiles set role = 'driver'
      where id = auth.uid() and role <> 'owner';
  end if;
  return d;
end;
$$;

-- ── Updated claim_client_by_email ─────────────────────────────────
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

  select * into c from public.clients where profile_id = auth.uid() limit 1;
  if found then
    update public.profiles set role = 'client'
      where id = auth.uid() and role <> 'owner' and role <> 'client';
    return c;
  end if;

  update public.clients
    set profile_id = auth.uid()
    where lower(email) = lower(uemail)
      and profile_id is null
    returning * into c;

  if found then
    update public.profiles set role = 'client'
      where id = auth.uid() and role <> 'owner';
  end if;
  return c;
end;
$$;

-- ── org_settings (singleton row) ─────────────────────────────────
create table if not exists public.org_settings (
  id int primary key default 1,
  brand_name text default 'SDLuxury Transportation, Inc.',
  dispatch_phone text,
  dispatch_email text,
  invoice_prefix text default 'SDL-',
  invoice_seq int default 1000,
  updated_at timestamptz default now(),
  constraint org_singleton check (id = 1)
);
insert into public.org_settings (id) values (1) on conflict do nothing;

alter table public.org_settings enable row level security;

drop policy if exists org_settings_authed_read on public.org_settings;
create policy org_settings_authed_read on public.org_settings
  for select using (auth.role() = 'authenticated');

drop policy if exists org_settings_owner_update on public.org_settings;
create policy org_settings_owner_update on public.org_settings
  for update using (public.is_owner()) with check (public.is_owner());

-- ── Invoice number helper ────────────────────────────────────────
create or replace function public.next_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  prefix text;
  n int;
begin
  update public.org_settings
    set invoice_seq = invoice_seq + 1, updated_at = now()
    where id = 1
    returning invoice_prefix, invoice_seq into prefix, n;
  return prefix || n::text;
end;
$$;
grant execute on function public.next_invoice_number() to authenticated;
