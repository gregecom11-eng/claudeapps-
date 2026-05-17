-- Run AFTER 20_ride_cost_defaults.sql in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Session 7c: client portal can read its own invoices.
--
-- Until now, invoices_owner_all was the only policy on
-- public.invoices, so signed-in clients saw nothing on the client
-- portal even for invoices issued to them. This adds a read policy
-- that joins invoices → rides → clients → profiles to scope a
-- client to "rows for rides on my client record."

drop policy if exists invoices_client_read on public.invoices;
create policy invoices_client_read on public.invoices
  for select using (
    exists (
      select 1
        from public.rides r
        join public.clients c on c.id = r.client_id
       where r.id = public.invoices.ride_id
         and c.profile_id = auth.uid()
    )
  );
