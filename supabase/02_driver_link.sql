-- Run AFTER schema.sql, one time, in Supabase → SQL Editor.
-- Enables the driver invite/sign-in flow:
--
--   1. Owner adds the driver in Settings with the driver's email.
--   2. Owner clicks "Send invite" — the dashboard sends a magic link
--      to that email via Supabase Auth.
--   3. Driver clicks the link, lands on the dashboard, gets a `profiles`
--      row with default role = 'driver'.
--   4. The driver app (this dashboard's `/driver` route) calls the RPC
--      below on first load. The RPC matches `drivers.email` to the
--      auth user's email and sets `drivers.profile_id = auth.uid()`,
--      which is what RLS uses to scope rides to that driver.
--
-- Idempotent: safe to re-run.

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
  if uemail is null then
    return null;
  end if;

  -- Already linked? Just return the row.
  select * into d from public.drivers
    where profile_id = auth.uid()
    limit 1;
  if found then
    return d;
  end if;

  -- Otherwise link the first matching unlinked driver row by email.
  update public.drivers
    set profile_id = auth.uid()
    where lower(email) = lower(uemail)
      and profile_id is null
    returning * into d;

  return d;  -- may be null if no driver record matches the email
end;
$$;

grant execute on function public.claim_driver_by_email() to authenticated;
