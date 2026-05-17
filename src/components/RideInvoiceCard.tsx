// Invoice manager for a single ride. Either lets the operator create
// the first invoice (with auto-numbering + due-date computed from the
// chosen terms) or shows the current invoice's status + actions
// (mark paid, mark void, copy a reminder snippet).
//
// Lives on the Invoice tab of RideDetail, above the printable packet.
//
// Net terms → due date math:
//   net_15           → +15 days
//   net_30           → +30 days
//   company_billing  → +30 days (treat as net_30)
//   invoice / cash / card / zelle / affiliate → no due date

import { useEffect, useState } from "react";
import {
  createInvoiceForRide,
  deleteInvoice,
  getInvoiceForRide,
  markInvoicePaid,
  markInvoiceSent,
  markInvoiceVoid,
} from "../lib/api";
import { fmtMoney } from "../lib/format";
import type {
  BillingTerms,
  Client,
  Invoice,
  InvoiceStatus,
  Ride,
} from "../lib/types";
import { Icon } from "./Icon";

const TERMS_LABEL: Record<string, string> = {
  cash: "Cash",
  card: "Card on file",
  zelle: "Zelle",
  net_15: "Net 15",
  net_30: "Net 30",
  net30: "Net 30",
  company_billing: "Company billing (Net 30)",
  affiliate: "Affiliate",
  invoice: "Invoice (other)",
};

function termsToDueDate(
  terms: BillingTerms | null,
  fromIso: string,
): string | null {
  const days =
    terms === "net_15"
      ? 15
      : terms === "net_30" || terms === "net30" || terms === "company_billing"
        ? 30
        : null;
  if (days === null) return null;
  const start = new Date(fromIso);
  start.setUTCDate(start.getUTCDate() + days);
  return start.toISOString().slice(0, 10);
}

function statusChipStyle(status: InvoiceStatus): React.CSSProperties {
  const map: Record<InvoiceStatus, { fg: string; bg: string }> = {
    draft: { fg: "var(--text-muted)", bg: "var(--surface-2)" },
    sent: { fg: "var(--accent)", bg: "color-mix(in oklab, var(--accent) 12%, transparent)" },
    paid: { fg: "var(--success)", bg: "color-mix(in oklab, var(--success) 12%, transparent)" },
    overdue: { fg: "var(--danger)", bg: "color-mix(in oklab, var(--danger) 12%, transparent)" },
    void: { fg: "var(--text-muted)", bg: "var(--surface-2)" },
  };
  const { fg, bg } = map[status];
  return {
    fontSize: 10.5,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    padding: "2px 8px",
    borderRadius: 3,
    color: fg,
    background: bg,
    fontWeight: 600,
  };
}

function buildReminderText(inv: Invoice, ride: Ride, client: Client | null) {
  const dueLine = inv.due_date ? `Due ${inv.due_date}.` : "Payment expected.";
  const greeting = client?.name
    ? `Hi ${client.name.split(" ")[0]},`
    : "Hi there,";
  return [
    greeting,
    "",
    `Quick reminder on invoice #${inv.number ?? inv.id.slice(0, 8)} —`,
    `${fmtMoney(inv.amount_cents)} for the ride on ${
      new Date(ride.pickup_at).toLocaleDateString("en-US", {
        timeZone: "America/Los_Angeles",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    }.`,
    dueLine,
    "",
    "Let me know if it's already on the way — happy to confirm receipt.",
    "",
    "Thanks!",
  ].join("\n");
}

export function RideInvoiceCard({
  ride,
  client,
}: {
  ride: Ride;
  client: Client | null;
}) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [terms, setTerms] = useState<BillingTerms>(
    (ride.billing_terms ??
      client?.default_billing ??
      "cash") as BillingTerms,
  );
  const [copied, setCopied] = useState(false);

  const reload = () => {
    getInvoiceForRide(ride.id)
      .then((inv) => {
        setInvoice(inv);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride.id]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const due = termsToDueDate(terms, ride.pickup_at);
      await createInvoiceForRide(
        ride.id,
        ride.total_cents,
        terms,
        due,
      );
      reload();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't create invoice. Check that the invoice number RPC is set up.",
      );
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (
    action: (id: string) => Promise<void>,
    confirmMsg?: string,
  ) => {
    if (!invoice) return;
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    setError(null);
    try {
      await action(invoice.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const removeInvoice = async () => {
    if (!invoice) return;
    if (
      !confirm(
        `Delete invoice ${invoice.number ?? invoice.id.slice(0, 8)} permanently? This can't be undone.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await deleteInvoice(invoice.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete.");
    } finally {
      setBusy(false);
    }
  };

  const copyReminder = async () => {
    if (!invoice) return;
    const text = buildReminderText(invoice, ride, client);
    try {
      await navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard unavailable.");
    }
  };

  const overdue =
    invoice?.status === "sent" &&
    !!invoice.due_date &&
    invoice.due_date < new Date().toISOString().slice(0, 10);

  return (
    <article className="surface rounded-[12px]">
      <header
        className="px-5 py-4 flex items-start justify-between gap-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <h3 style={{ fontSize: 14.5, fontWeight: 600 }}>
            Invoice
            {invoice ? (
              <span
                className="ml-2"
                style={statusChipStyle(invoice.status)}
              >
                {invoice.status}
              </span>
            ) : null}
            {overdue ? (
              <span
                className="ml-2"
                style={statusChipStyle("overdue")}
              >
                overdue
              </span>
            ) : null}
          </h3>
          <p
            className="text-muted mt-0.5"
            style={{ fontSize: 12, lineHeight: 1.5 }}
          >
            {invoice
              ? `#${invoice.number ?? invoice.id.slice(0, 8)} · ${fmtMoney(invoice.amount_cents)}${invoice.due_date ? ` · due ${invoice.due_date}` : ""}`
              : "Create a record so this ride shows up on the AR aging panel."}
          </p>
        </div>
      </header>

      {!loaded ? (
        <div className="px-5 py-6 text-muted text-sm">Checking…</div>
      ) : !invoice ? (
        <div className="px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label className="label">Billing terms</label>
              <select
                className="field"
                value={terms}
                onChange={(e) => setTerms(e.target.value as BillingTerms)}
              >
                {Object.entries(TERMS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <p className="help">
                {termsToDueDate(terms, ride.pickup_at)
                  ? `Due ${termsToDueDate(terms, ride.pickup_at)} (auto-computed).`
                  : "No due date — paid at time of ride."}
              </p>
            </div>
            <div className="flex items-end">
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={create}
              >
                {busy ? "Creating…" : "Create invoice"}
              </button>
            </div>
          </div>
          {error ? (
            <p className="text-danger mt-3" style={{ fontSize: 12.5 }}>
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Number" value={`#${invoice.number ?? invoice.id.slice(0, 8)}`} />
            <Field label="Amount" value={fmtMoney(invoice.amount_cents)} />
            <Field
              label="Terms"
              value={
                invoice.terms
                  ? (TERMS_LABEL[invoice.terms] ?? invoice.terms)
                  : "—"
              }
            />
            <Field label="Due" value={invoice.due_date ?? "—"} />
            {invoice.paid_at ? (
              <Field
                label="Paid"
                value={new Date(invoice.paid_at).toLocaleDateString(
                  "en-US",
                  { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" },
                )}
              />
            ) : null}
            <Field
              label="Created"
              value={new Date(invoice.created_at).toLocaleDateString(
                "en-US",
                { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" },
              )}
            />
          </div>

          <div className="mt-5 flex items-center gap-2 flex-wrap">
            {invoice.status === "draft" ? (
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() => setStatus(markInvoiceSent)}
              >
                Mark sent
              </button>
            ) : null}
            {invoice.status !== "paid" && invoice.status !== "void" ? (
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() => setStatus(markInvoicePaid)}
              >
                <Icon name="check" size={13} /> Mark paid
              </button>
            ) : null}
            {invoice.status !== "void" ? (
              <button
                className="btn btn-ghost"
                disabled={busy}
                onClick={() =>
                  setStatus(
                    markInvoiceVoid,
                    `Void invoice ${invoice.number ?? invoice.id.slice(0, 8)}? This keeps the record but stops it counting toward AR.`,
                  )
                }
              >
                Mark void
              </button>
            ) : null}
            {invoice.status === "sent" || invoice.status === "overdue" ? (
              <button
                className="btn btn-ghost"
                disabled={busy}
                onClick={copyReminder}
                title="Copy a polite reminder you can paste into email or text"
              >
                <Icon name="copy" size={13} />
                {copied ? "Copied!" : "Copy reminder"}
              </button>
            ) : null}
            <button
              className="btn btn-ghost"
              style={{ color: "var(--danger)" }}
              disabled={busy}
              onClick={removeInvoice}
            >
              Delete
            </button>
          </div>

          {error ? (
            <p className="text-danger mt-3" style={{ fontSize: 12.5 }}>
              {error}
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-muted"
        style={{
          fontSize: 10.5,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div className="mt-1 tnum" style={{ fontSize: 14, fontWeight: 500 }}>
        {value}
      </div>
    </div>
  );
}
