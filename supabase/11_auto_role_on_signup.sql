-- Run AFTER previous migrations, one time, in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Fixes a footgun where every new auth user landed in profiles with
-- role='driver' (the column default). A client signing up via magic
-- link was getting routed to the chauffeur dashboard until somebody
-- manually flipped their role.
--
-- New behavior: handle_new_user looks up the signup email in the
-- clients and drivers tables and assigns role + profile_id link in
-- one pass. Unmatched signups default to 'client' (the public-facing
-- entry point is /book → become a client, not a driver).

-- Change the column default so any future inserts skipping our trigger
-- (e.g. manual seeds) also default to client.
alter table public.profiles
  alter column role set default 'client';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_client_id uuid;
  matched_driver_id uuid;
  resolved_role public.user_role := 'client';
begin
  -- Prefer a client match (the more common public-facing signup), then
  -- fall back to a drivers row with the same email.
  if new.email is not null and length(btrim(new.email)) > 0 then
    select id into matched_client_id
      from public.clients
      where lower(email) = lower(new.email)
        and profile_id is null
      limit 1;

    if matched_client_id is null then
      select id into matched_driver_id
        from public.drivers
        where lower(email) = lower(new.email)
          and profile_id is null
        limit 1;
      if matched_driver_id is not null then
        resolved_role := 'driver';
      end if;
    end if;
  end if;

  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    resolved_role,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;

  if matched_client_id is not null then
    update public.clients
      set profile_id = new.id
      where id = matched_client_id;
  elsif matched_driver_id is not null then
    update public.drivers
      set profile_id = new.id
      where id = matched_driver_id;
  end if;

  return new;
end;
$$;

-- Trigger definition stays the same; we just refreshed the function.

-- ── Backfill ──────────────────────────────────────────────────────
-- Any auth user whose profile is still on the legacy role='driver'
-- default AND whose email matches an unclaimed clients row should
-- become a client. Owners are never touched.
do $$
declare
  rec record;
begin
  for rec in
    select u.id as user_id, u.email, c.id as client_id
      from auth.users u
      join public.profiles p on p.id = u.id
      join public.clients c on lower(c.email) = lower(u.email)
      where p.role = 'driver'
        and c.profile_id is null
        and not exists (
          select 1 from public.drivers d
            where d.profile_id = u.id
        )
  loop
    update public.profiles
      set role = 'client'
      where id = rec.user_id;
    update public.clients
      set profile_id = rec.user_id
      where id = rec.client_id;
  end loop;
end $$;
