-- Run AFTER 18_expenses.sql in Supabase → SQL Editor.
-- Idempotent: safe to re-run.
--
-- Session 7a: auto-create an invoice when a ride completes for a
-- client on net terms (Net 15 / Net 30 / company billing). Cash and
-- card clients aren't invoiced automatically — those get a paper
-- receipt at time of ride.
--
-- The trigger guards against:
--   * status not transitioning into 'completed'
--   * rides without a client_id (walk-ins)
--   * double-invoicing (an existing invoice for the ride wins)
--   * any unexpected error inside the trigger (RAISES WARNING but
--     doesn't block the status update — invoicing is a side-effect,
--     it shouldn't break the primary write)

create or replace function public.auto_invoice_completed_ride()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.clients%rowtype;
  num text;
  due_days int;
  due_date date;
begin
  -- Only when status transitions INTO 'completed'.
  if new.status <> 'completed' then return new; end if;
  if old.status = 'completed' then return new; end if;

  -- No client → no invoice.
  if new.client_id is null then return new; end if;

  -- Don't double-invoice an already-invoiced ride.
  if exists (
    select 1 from public.invoices where ride_id = new.id
  ) then
    return new;
  end if;

  select * into c from public.clients where id = new.client_id;
  if not found then return new; end if;

  -- Net-terms only. Cash / card / zelle / affiliate skip auto-invoice.
  if c.default_billing not in ('net_15', 'net_30', 'company_billing') then
    return new;
  end if;

  due_days := case c.default_billing
    when 'net_15' then 15
    when 'net_30' then 30
    when 'company_billing' then 30
    else null
  end;

  -- Use the pickup date (LA tz) as the basis for the due-date math.
  -- Casting the timestamptz with the zone gives the correct civil
  -- date that the operator booked the ride for.
  due_date := ((new.pickup_at at time zone 'America/Los_Angeles')::date)
    + due_days;

  num := public.next_invoice_number();

  insert into public.invoices (
    ride_id, number, amount_cents, terms, due_date, status, notes
  ) values (
    new.id,
    num,
    new.total_cents,
    c.default_billing,
    due_date,
    'sent',
    'Auto-invoiced on ride completion.'
  );

  -- Activity feed: a small entry so the operator sees what happened.
  -- Use the same PII-friendly format other auto-events use.
  insert into public.events (ride_id, source, message, metadata)
    values (
      new.id,
      'system',
      format('Invoice %s issued · %s · %s',
        num,
        coalesce(c.company, c.name),
        c.default_billing),
      jsonb_build_object('invoice_number', num, 'amount_cents', new.total_cents)
    );

  return new;
exception when others then
  -- Don't let an invoicing hiccup block marking a ride completed.
  raise warning 'auto_invoice_completed_ride: %', sqlerrm;
  return new;
end $$;

drop trigger if exists rides_auto_invoice on public.rides;
create trigger rides_auto_invoice
  after update of status on public.rides
  for each row execute function public.auto_invoice_completed_ride();
