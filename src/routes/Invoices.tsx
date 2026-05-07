import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createInvoiceForRide,
  deleteInvoice,
  listInvoices,
  listRides,
  markInvoicePaid,
} from "../lib/api";
import { fmtDate, fmtMoney } from "../lib/format";
import { Icon } from "../components/Icon";
import type { Invoice, InvoiceStatus, Ride } from "../lib/types";

type Filter = "open" | "overdue" | "paid" | "all";

export function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = () => {
    Promise.all([listInvoices(), listRides({ limit: 200 })])
      .then(([i, r]) => {
        setInvoices(i);
        setRides(r);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      );
  };
  useEffect(reload, []);

  const ridesById = useMemo(
    () => new Map(rides.map((r) => [r.id, r])),
    [rides],
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const overdue =
        inv.status !== "paid" &&
        inv.due_date &&
        new Date(inv.due_date) < today;
      if (filter === "open")
        return inv.status === "sent" || inv.status === "draft";
      if (filter === "overdue") return overdue;
      if (filter === "paid") return inv.status === "paid";
      return true;
    });
  }, [invoices, filter]);

  const totals = useMemo(() => {
    const open = invoices
      .filter((i) => i.status === "sent" || i.status === "draft")
      .reduce((s, i) => s + i.amount_cents, 0);
    const overdueTotal = invoices
      .filter(
        (i) =>
          i.status !== "paid" &&
          i.due_date &&
          new Date(i.due_date) < today,
      )
      .reduce((s, i) => s + i.amount_cents, 0);
    const paidThisMonth = invoices
      .filter(
        (i) =>
          i.status === "paid" &&
          i.paid_at &&
          new Date(i.paid_at).getMonth() === today.getMonth() &&
          new Date(i.paid_at).getFullYear() === today.getFullYear(),
      )
      .reduce((s, i) => s + i.amount_cents, 0);
    return { open, overdueTotal, paidThisMonth };
  }, [invoices]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div
            className="text-muted"
            style={{
              fontSize: 12.5,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Billing
          </div>
          <h1
            className="mt-1"
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            Invoices
          </h1>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-[8px] text-[13.5px] font-medium"
          style={{
            background: "var(--accent)",
            color: "#15161B",
            border: "1px solid var(--accent-strong)",
          }}
        >
          <Icon name="plus" size={14} /> New invoice
        </button>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
        <KpiTile label="Open" amount={totals.open} hint="Awaiting payment" />
        <KpiTile
          label="Overdue"
          amount={totals.overdueTotal}
          hint="Past due date"
          accent
        />
        <KpiTile
          label="Paid this month"
          amount={totals.paidThisMonth}
          hint="Net inflow"
        />
      </div>

      {error ? (
        <div className="surface rounded-[12px] p-4 text-danger text-sm">
          {error}
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["open", "overdue", "paid", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="inline-flex items-center h-8 px-3 rounded-[8px] text-[13px] capitalize transition"
            style={{
              color: filter === f ? "var(--text)" : "var(--text-muted)",
              background: filter === f ? "var(--surface-2)" : "transparent",
              border:
                filter === f
                  ? "1px solid var(--border)"
                  : "1px solid transparent",
              fontWeight: filter === f ? 600 : 500,
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="surface rounded-[12px] p-8 text-center text-muted text-sm">
          No invoices match this filter.
        </div>
      ) : (
        <ul className="surface rounded-[12px] divide-y divide-border">
          {filtered.map((inv) => {
            const ride = inv.ride_id ? ridesById.get(inv.ride_id) : null;
            const overdue =
              inv.status !== "paid" &&
              inv.due_date &&
              new Date(inv.due_date) < today;
            return (
              <li key={inv.id} className="p-4 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div
                    className="flex items-center gap-2 flex-wrap"
                    style={{ fontSize: 14, fontWeight: 600 }}
                  >
                    {inv.number ?? "—"}
                    <InvoiceStatusBadge status={inv.status} overdue={!!overdue} />
                  </div>
                  <div
                    className="text-muted truncate tabular"
                    style={{ fontSize: 12 }}
                  >
                    {ride
                      ? `${ride.passenger_name} · ${fmtDate(ride.pickup_at)}`
                      : "Standalone"}
                    {inv.due_date
                      ? ` · due ${fmtDate(inv.due_date as string)}`
                      : ""}
                  </div>
                </div>
                <div
                  className="tabular"
                  style={{ fontSize: 15, fontWeight: 600 }}
                >
                  {fmtMoney(inv.amount_cents)}
                </div>
                <InvoiceRowActions
                  invoice={inv}
                  ride={ride ?? null}
                  onChanged={reload}
                />
              </li>
            );
          })}
        </ul>
      )}

      {creating ? (
        <NewInvoiceModal
          rides={rides}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

function KpiTile({
  label,
  amount,
  hint,
  accent,
}: {
  label: string;
  amount: number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="surface rounded-[12px] p-4 md:p-5"
      style={{ minHeight: 92 }}
    >
      <div
        className="text-muted"
        style={{
          fontSize: 12,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        className="mt-2 tabular"
        style={{
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: accent ? "var(--warn)" : "var(--text)",
        }}
      >
        {fmtMoney(amount)}
      </div>
      {hint ? (
        <div
          className="text-muted mt-1"
          style={{ fontSize: 12 }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function InvoiceStatusBadge({
  status,
  overdue,
}: {
  status: InvoiceStatus;
  overdue: boolean;
}) {
  if (overdue) {
    return (
      <span
        className="chip"
        style={{
          background: "transparent",
          color: "var(--warn)",
          fontSize: 11,
          borderColor: "color-mix(in oklab, var(--warn) 35%, var(--border))",
        }}
      >
        Overdue
      </span>
    );
  }
  const map: Record<InvoiceStatus, string> = {
    draft: "var(--text-muted)",
    sent: "var(--accent)",
    paid: "var(--success)",
    overdue: "var(--warn)",
    void: "var(--danger)",
  };
  return (
    <span
      className="chip"
      style={{
        background: "transparent",
        color: map[status],
        fontSize: 11,
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}

function InvoiceRowActions({
  invoice,
  ride,
  onChanged,
}: {
  invoice: Invoice;
  ride: Ride | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const onPaid = async () => {
    setBusy(true);
    try {
      await markInvoicePaid(invoice.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const sendReminder = () => {
    if (!ride) return;
    const subject = `Friendly reminder · invoice ${invoice.number ?? ""}`;
    const lines = [
      `Hi${
        ride.passenger_name ? ` ${ride.passenger_name.split(" ")[0]}` : ""
      },`,
      "",
      `A quick note that invoice ${invoice.number ?? ""} for ${fmtMoney(
        invoice.amount_cents,
      )} is now due. Let me know once it's been remitted, or if you'd like a fresh copy.`,
      "",
      "Thank you,",
      "SDLuxury Transportation",
    ].join("\n");
    const mailto = `mailto:?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(lines)}`;
    window.location.href = mailto;
  };

  const onDelete = async () => {
    if (!confirm(`Delete invoice ${invoice.number ?? "draft"}?`)) return;
    setBusy(true);
    try {
      await deleteInvoice(invoice.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {invoice.status !== "paid" ? (
        <button
          onClick={onPaid}
          disabled={busy}
          title="Mark paid"
          aria-label="Mark paid"
          className="inline-grid place-items-center"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "1px solid var(--border)",
            color: "var(--success)",
            background: "transparent",
          }}
        >
          <Icon name="check" size={13} />
        </button>
      ) : null}
      {invoice.status !== "paid" && ride ? (
        <button
          onClick={sendReminder}
          title="Send reminder email"
          aria-label="Send reminder"
          className="inline-grid place-items-center"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
            background: "transparent",
          }}
        >
          <Icon name="phone" size={13} />
        </button>
      ) : null}
      {ride ? (
        <Link
          to={`/rides/${ride.id}`}
          title="Open ride"
          aria-label="Open ride"
          className="inline-grid place-items-center"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
        >
          <Icon name="arrow" size={13} />
        </Link>
      ) : null}
      <button
        onClick={onDelete}
        disabled={busy}
        title="Delete"
        aria-label="Delete"
        className="inline-grid place-items-center"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          border: "1px solid var(--border)",
          color: "var(--danger)",
          background: "transparent",
        }}
      >
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}

function NewInvoiceModal({
  rides,
  onClose,
  onCreated,
}: {
  rides: Ride[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [rideId, setRideId] = useState<string>(rides[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [terms, setTerms] = useState<string>("net_30");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ride = useMemo(() => rides.find((r) => r.id === rideId), [rideId, rides]);

  // Default the amount to the ride's total when the ride changes.
  useEffect(() => {
    if (ride) {
      setAmount((ride.total_cents / 100).toFixed(2));
      // Default due date based on terms
      const addDays = terms === "net_15" ? 15 : terms === "net_30" ? 30 : 0;
      if (addDays > 0) {
        const d = new Date();
        d.setDate(d.getDate() + addDays);
        setDueDate(d.toISOString().slice(0, 10));
      }
    }
  }, [rideId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rideId) return;
    const cents = Math.round(parseFloat(amount || "0") * 100);
    if (!cents || cents <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createInvoiceForRide(
        rideId,
        cents,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        terms as any,
        dueDate || null,
      );
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end md:items-center justify-center"
      style={{ background: "color-mix(in oklab, #000 50%, transparent)" }}
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="surface rounded-t-[16px] md:rounded-[16px] w-full md:max-w-[520px] p-5"
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          New invoice
        </h2>
        <div className="mt-4 grid gap-3">
          <label className="block text-sm">
            <span className="label">Ride</span>
            <select
              className="field"
              value={rideId}
              onChange={(e) => setRideId(e.target.value)}
              required
            >
              {rides.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.passenger_name} · {fmtDate(r.pickup_at)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="label">Amount</span>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted tnum"
                  style={{ fontSize: 14, pointerEvents: "none" }}
                >
                  $
                </span>
                <input
                  className="field tnum"
                  style={{ paddingLeft: 28 }}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) =>
                    setAmount(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  required
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="label">Terms</span>
              <select
                className="field"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              >
                <option value="cash">Cash · due now</option>
                <option value="card">Card</option>
                <option value="zelle">Zelle</option>
                <option value="net_15">Net 15</option>
                <option value="net_30">Net 30</option>
                <option value="company_billing">Company-billed</option>
              </select>
            </label>
          </div>
          <label className="block text-sm">
            <span className="label">Due date</span>
            <input
              type="date"
              className="field tnum"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
        </div>

        {error ? (
          <div className="mt-3 text-danger text-sm">{error}</div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center h-9 px-3 rounded-[8px] text-[13px]"
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-[8px] text-[13.5px] font-medium disabled:opacity-50"
            style={{
              background: "var(--accent)",
              color: "#15161B",
              border: "1px solid var(--accent-strong)",
            }}
          >
            {busy ? "Creating…" : "Create invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}
