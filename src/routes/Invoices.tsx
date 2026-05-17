// /invoices — owner's accounts-receivable list.
//
// Filter chips by status (All / Sent / Overdue / Paid / Void / Draft).
// Each row links back to the ride detail. Bulk actions handled per row
// for v1: mark paid, mark void, open ride. A reminder snippet is
// copyable for "send via your own channel" workflows.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteInvoice,
  listClients,
  listInvoices,
  listRides,
  markInvoicePaid,
  markInvoiceSent,
  markInvoiceVoid,
} from "../lib/api";
import { fmtMoney } from "../lib/format";
import type {
  Client,
  Invoice,
  InvoiceStatus,
  Ride,
} from "../lib/types";
import { Icon } from "../components/Icon";

type StatusFilter = "all" | InvoiceStatus | "open";

const STATUS_CHIPS: { id: StatusFilter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "sent", label: "Sent" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
  { id: "draft", label: "Draft" },
  { id: "void", label: "Void" },
  { id: "all", label: "All" },
];

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
    fontSize: 10,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    padding: "2px 7px",
    borderRadius: 3,
    color: fg,
    background: bg,
    fontWeight: 600,
    whiteSpace: "nowrap",
  };
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 86_400_000);
}

export function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("open");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [inv, cs] = await Promise.all([listInvoices(), listClients()]);
      setInvoices(inv);
      setClients(cs);
      // Pull rides referenced by invoices so we can show passenger /
      // pickup date in the list. One bulk call beats N round-trips.
      const ids = Array.from(
        new Set(inv.map((i) => i.ride_id).filter((x): x is string => !!x)),
      );
      if (ids.length === 0) {
        setRides([]);
      } else {
        // listRides doesn't filter by id, so pull a generous window
        // (12 months trailing) and intersect locally. Fine at this scale.
        const to = new Date();
        const from = new Date(to.getTime() - 365 * 86_400_000);
        const rs = await listRides({
          from: from.toISOString(),
          to: to.toISOString(),
          limit: 1000,
        });
        setRides(rs);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load invoices.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-promote sent → overdue locally (read-only — we don't write the
  // row unless the operator takes an action). The DB still says "sent",
  // but the UI badges it overdue so the operator sees it without an
  // explicit nightly job.
  const ridesById = useMemo(
    () => new Map(rides.map((r) => [r.id, r])),
    [rides],
  );
  const clientsById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients],
  );
  const today = new Date().toISOString().slice(0, 10);

  type Enriched = Invoice & {
    effectiveStatus: InvoiceStatus;
    ride: Ride | null;
    client: Client | null;
    daysOpen: number;
    daysLate: number;
  };
  const enriched: Enriched[] = useMemo(() => {
    return invoices.map((inv) => {
      const ride = inv.ride_id ? ridesById.get(inv.ride_id) ?? null : null;
      const client = ride?.client_id
        ? clientsById.get(ride.client_id) ?? null
        : null;
      const effectiveStatus: InvoiceStatus =
        inv.status === "sent" && inv.due_date && inv.due_date < today
          ? "overdue"
          : inv.status;
      const daysOpen = daysBetween(new Date(), new Date(inv.created_at));
      const daysLate =
        inv.due_date && inv.due_date < today
          ? daysBetween(new Date(), new Date(inv.due_date + "T23:59:59Z"))
          : 0;
      return {
        ...inv,
        effectiveStatus,
        ride,
        client,
        daysOpen,
        daysLate,
      };
    });
  }, [invoices, ridesById, clientsById, today]);

  const filtered: Enriched[] = useMemo(() => {
    let rows = enriched;
    if (filter === "open") {
      rows = rows.filter(
        (r) =>
          r.effectiveStatus === "sent" || r.effectiveStatus === "overdue",
      );
    } else if (filter !== "all") {
      rows = rows.filter((r) => r.effectiveStatus === filter);
    }
    if (query.trim().length > 0) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((r) => {
        return (
          (r.number ?? "").toLowerCase().includes(q) ||
          (r.client?.name ?? "").toLowerCase().includes(q) ||
          (r.client?.company ?? "").toLowerCase().includes(q) ||
          (r.ride?.passenger_name ?? "").toLowerCase().includes(q)
        );
      });
    }
    return rows.sort((a, b) => {
      // Oldest unpaid first; otherwise by created desc.
      if (
        (a.effectiveStatus === "overdue" || a.effectiveStatus === "sent") &&
        (b.effectiveStatus === "overdue" || b.effectiveStatus === "sent")
      ) {
        return b.daysLate - a.daysLate;
      }
      return b.created_at.localeCompare(a.created_at);
    });
  }, [enriched, filter, query]);

  // KPI band totals (across the *current filter*).
  const totals = useMemo(() => {
    return filtered.reduce(
      (a, r) => ({
        count: a.count + 1,
        amount: a.amount + r.amount_cents,
      }),
      { count: 0, amount: 0 },
    );
  }, [filtered]);

  const setStatus = async (
    inv: Enriched,
    action: (id: string) => Promise<void>,
    confirmMsg?: string,
  ) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await action(inv.id);
      load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (inv: Enriched) => {
    if (
      !confirm(
        `Delete invoice ${inv.number ?? inv.id.slice(0, 8)} permanently?`,
      )
    )
      return;
    setBusy(true);
    try {
      await deleteInvoice(inv.id);
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div
        className="flex items-end justify-between gap-6 pb-7 mb-7 flex-wrap"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="min-w-0">
          <p className="eyebrow mb-3" style={{ letterSpacing: "0.22em" }}>
            Accounts receivable
          </p>
          <h1
            className="serif"
            style={{
              fontSize: 44,
              lineHeight: 1.05,
              letterSpacing: "-0.015em",
              fontWeight: 500,
            }}
          >
            Money still on the{" "}
            <span style={{ fontStyle: "italic", color: "var(--accent)" }}>
              books
            </span>
            .
          </h1>
          <p
            className="text-muted mt-3"
            style={{ fontSize: 14.5, maxWidth: 560, lineHeight: 1.55 }}
          >
            Mark invoices paid, copy a polite reminder, or void something
            you decided not to collect. Open the ride to see the full
            packet.
          </p>
        </div>
      </div>

      {error ? (
        <div
          className="mb-5 rounded-[6px] p-4"
          style={{
            background:
              "color-mix(in oklab, var(--danger) 8%, var(--surface))",
            border: "1px solid var(--danger)",
            color: "var(--danger)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      {/* Controls */}
      <div
        className="rounded-[6px] p-3 md:p-4 flex items-center justify-between gap-3 flex-wrap mb-5"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_CHIPS.map((c) => {
            const active = filter === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                style={{
                  height: 32,
                  padding: "0 14px",
                  borderRadius: 4,
                  fontSize: 12.5,
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  border: `1px solid ${active ? "var(--text)" : "var(--border)"}`,
                  background: active ? "var(--text)" : "var(--surface)",
                  color: active ? "var(--bg)" : "var(--text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <input
            className="field"
            style={{ height: 32, fontSize: 13, width: 200 }}
            placeholder="Search number / client…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Filtered totals */}
      <div className="grid gap-4 md:grid-cols-3 mb-5">
        <Stat label={`${STATUS_CHIPS.find((c) => c.id === filter)?.label ?? ""} count`} value={String(totals.count)} />
        <Stat label="Amount in view" value={fmtMoney(totals.amount)} accent />
        <Stat
          label="Oldest"
          value={
            filtered.length > 0
              ? `${filtered[0].daysLate > 0 ? `${filtered[0].daysLate}d late` : `${filtered[0].daysOpen}d open`}`
              : "—"
          }
        />
      </div>

      {!loaded ? (
        <div className="text-muted">Loading invoices…</div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-[6px] p-8 text-center text-muted"
          style={{
            background: "var(--surface-2)",
            border: "1px dashed var(--border)",
          }}
        >
          <Icon name="invoice" size={20} className="mx-auto opacity-60" />
          <p className="mt-2" style={{ fontSize: 13.5 }}>
            {invoices.length === 0
              ? "No invoices yet. Open any completed ride and create one from the Invoice tab."
              : `No invoices match this filter.`}
          </p>
        </div>
      ) : (
        <div
          className="rounded-[6px] overflow-hidden"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: 13 }}>
              <thead>
                <tr
                  className="text-left"
                  style={{
                    fontSize: 10.5,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv, i) => (
                  <tr
                    key={inv.id}
                    style={{
                      borderTop:
                        i === 0 ? "none" : "1px solid var(--border)",
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="tnum" style={{ fontWeight: 500 }}>
                        #{inv.number ?? inv.id.slice(0, 8)}
                      </div>
                      <div
                        className="text-muted tnum"
                        style={{ fontSize: 11.5 }}
                      >
                        Created{" "}
                        {new Date(inv.created_at).toLocaleDateString("en-US", {
                          timeZone: "America/Los_Angeles",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div style={{ fontSize: 13 }}>
                        {inv.client?.company ??
                          inv.client?.name ??
                          inv.ride?.passenger_name ??
                          "Unknown"}
                      </div>
                      <div
                        className="text-muted"
                        style={{ fontSize: 11.5 }}
                      >
                        {inv.ride
                          ? new Date(inv.ride.pickup_at).toLocaleDateString(
                              "en-US",
                              {
                                timeZone: "America/Los_Angeles",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )
                          : "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tnum">
                      {fmtMoney(inv.amount_cents)}
                    </td>
                    <td
                      className="px-4 py-3 text-muted tnum"
                      style={{ fontSize: 12 }}
                    >
                      {inv.due_date ?? "—"}
                      {inv.daysLate > 0 ? (
                        <div
                          className="text-danger"
                          style={{ fontSize: 11 }}
                        >
                          {inv.daysLate}d late
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span style={statusChipStyle(inv.effectiveStatus)}>
                        {inv.effectiveStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {inv.ride ? (
                          <Link
                            to={`/rides/${inv.ride.id}?tab=invoice`}
                            className="btn btn-ghost"
                            style={{
                              height: 30,
                              padding: "0 10px",
                              fontSize: 12,
                            }}
                          >
                            Open
                          </Link>
                        ) : null}
                        {inv.effectiveStatus === "draft" ? (
                          <button
                            className="btn btn-ghost"
                            style={{
                              height: 30,
                              padding: "0 10px",
                              fontSize: 12,
                            }}
                            disabled={busy}
                            onClick={() => setStatus(inv, markInvoiceSent)}
                          >
                            Mark sent
                          </button>
                        ) : null}
                        {inv.effectiveStatus !== "paid" &&
                        inv.effectiveStatus !== "void" ? (
                          <button
                            className="btn btn-ghost"
                            style={{
                              height: 30,
                              padding: "0 10px",
                              fontSize: 12,
                              color: "var(--success)",
                            }}
                            disabled={busy}
                            onClick={() => setStatus(inv, markInvoicePaid)}
                          >
                            Paid
                          </button>
                        ) : null}
                        {inv.effectiveStatus !== "void" ? (
                          <button
                            className="btn btn-ghost"
                            style={{
                              height: 30,
                              padding: "0 10px",
                              fontSize: 12,
                            }}
                            disabled={busy}
                            onClick={() =>
                              setStatus(
                                inv,
                                markInvoiceVoid,
                                `Void ${inv.number ?? inv.id.slice(0, 8)}?`,
                              )
                            }
                          >
                            Void
                          </button>
                        ) : null}
                        <button
                          className="btn btn-ghost"
                          style={{
                            height: 30,
                            padding: "0 10px",
                            fontSize: 12,
                            color: "var(--danger)",
                          }}
                          disabled={busy}
                          onClick={() => remove(inv)}
                          title="Delete"
                        >
                          <Icon name="x" size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-[6px] p-5"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <p className="eyebrow" style={{ letterSpacing: "0.22em" }}>
        {label}
      </p>
      <div
        className="serif tnum mt-1"
        style={{
          fontSize: 28,
          letterSpacing: "-0.01em",
          color: accent ? "var(--accent)" : "var(--text)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
