-- Run AFTER 16_client_company_update.sql in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Session 5: owner-driver identity + commission scaffolding.
--
-- Why:
--   The Earnings page needs to distinguish "money the company collected"
--   from "money the owner personally takes home." When the owner drives,
--   they keep 100% of the ride. When another driver drives, the company
--   keeps a configurable share (commission_rate_bps; basis points, so
--   2000 = 20%). Today every driver defaults to 0 — i.e. other drivers'
--   rides contribute $0 to the owner's income. Raising the rate later
--   automatically starts splitting revenue with no code change.
--
-- What:
--   1. drivers.is_owner             boolean, at most one row may be true
--   2. drivers.commission_rate_bps  int (0..10000), default 0
--   3. Seed: mark the existing "Greg" row as the owner

alter table public.drivers
  add column if not exists is_owner boolean default false;

alter table public.drivers
  add column if not exists commission_rate_bps integer default 0;

do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'drivers_commission_rate_bps_range'
  ) then
    alter table public.drivers
      add constraint drivers_commission_rate_bps_range
      check (commission_rate_bps >= 0 and commission_rate_bps <= 10000);
  end if;
end $$;

-- At most one owner-driver across the whole table.
do $$
begin
  if not exists (
    select 1 from pg_indexes where indexname = 'drivers_one_owner_idx'
  ) then
    create unique index drivers_one_owner_idx
      on public.drivers ((1)) where is_owner = true;
  end if;
end $$;

-- Mark Greg as the owner. Pick the oldest active "Greg*" row; only run
-- if no owner is set yet so re-running this migration is a no-op.
update public.drivers
   set is_owner = true
 where id = (
   select id from public.drivers
    where lower(full_name) like 'greg%'
      and active = true
    order by created_at asc
    limit 1
 )
 and not exists (select 1 from public.drivers where is_owner = true);
