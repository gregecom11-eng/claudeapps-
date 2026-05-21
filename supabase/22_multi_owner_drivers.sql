-- Run AFTER 21_client_invoice_read.sql in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Session 8: allow multiple owner-driver rows.
--
-- An owner-operator accumulates several driver identities over time
-- ("Greg V", "Greg Business", a legacy seed row, ...). They're all the
-- same person. The original single-owner unique index forced a choice;
-- this drops it so every row that is really the owner can be flagged.
--
-- Earnings math (src/lib/earnings.ts) treats a ride as 100% owner
-- income when its driver is ANY owner-flagged row, OR when the ride is
-- unassigned (a solo operator covers their own unassigned rides).

drop index if exists public.drivers_one_owner_idx;

-- Flag every "Greg*" driver row as the owner. Adjust to taste from the
-- Drivers page ("This is me" toggle) afterwards.
update public.drivers
   set is_owner = true
 where lower(full_name) like 'greg%';
