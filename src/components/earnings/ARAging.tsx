// AR aging panel — buckets outstanding invoices by how late they are.
// Reads directly from the invoices table; rolled-up totals + a list of
// the oldest open invoices. Empty state explains how to populate it
// (create invoices from completed rides).

import { Link } from "react-router-dom";
import { fmtMoney } from "../../lib/format";
import { Icon } from "../Icon";
import type { Invoice } from "../../lib/types";

export type AgingBucket = {
  key: "current" | "late1" | "late2" | "late3";
  label: string;
  color: string;
  totalCents: number;
  count: number;
};

function bucketFor(
  daysLate: number,
): AgingBucket["key"] {
  if (daysLate <= 0) return "current";
  if (daysLate <= 30) return "late1";
  if (daysLate <= 60) return "late2";
  return "late3";
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 86400_000);
}

export function buildAging(
  invoices: Invoice[],
  now: Date = new Date(),
): {
  buckets: AgingBucket[];
  totalCents: number;
  totalCount: number;
  oldest: Array<Invoice & { daysOpen: number; daysLate: number }>;
} {
  const open = invoices.filter(
    (inv) => inv.status === "sent" || inv.status === "overdue",
  );
  const enriched = open.map((inv) => {
    const due = inv.due_date ? new Date(inv.due_date + "T23:59:59Z") : null;
    const daysLate = due ? Math.max(0, daysBetween(now, due)) : 0;
    const daysOpen = daysBetween(now, new Date(inv.created_at));
    return { ...inv, daysOpen, daysLate };
  });

  const accum: Record<AgingBucket["key"], { totalCents: number; count: number }> = {
    current: { totalCents: 0, count: 0 },
    late1: { totalCents: 0, count: 0 },
    late2: { totalCents: 0, count: 0 },
    late3: { totalCents: 0, count: 0 },
  };
  for (const inv of enriched) {
    const k = bucketFor(inv.daysLate);
    accum[k].totalCents += inv.amount_cents;
    accum[k].count += 1;
  }

  const buckets: AgingBucket[] = [
    {
      key: "current",
      label: "Current",
      color: "var(--success)",
      ...accum.current,
    },
    {
      key: "late1",
      label: "1 – 30 days",
      color: "var(--accent)",
      ...accum.late1,
    },
    {
      key: "late2",
      label: "31 – 60 days",
      color: "var(--warn)",
      ...accum.late2,
    },
    {
      key: "late3",
      label: "60+ days",
      color: "var(--danger)",
      ...accum.late3,
    },
  ];
  const totalCents = buckets.reduce((s, b) => s + b.totalCents, 0);
  const totalCount = buckets.reduce((s, b) => s + b.count, 0);

  const oldest = enriched
    .sort((a, b) => b.daysOpen - a.daysOpen)
    .slice(0, 5);
  return { buckets, totalCents, totalCount, oldest };
}

export function EarningsARAging({
  invoices,
  emptyHint,
}: {
  invoices: Invoice[];
  emptyHint?: string;
}) {
  const { buckets, totalCents, totalCount, oldest } = buildAging(invoices);
  const hasData = totalCents > 0;

  return (
    <div
      className="rounded-[6px] p-5 md:p-6 fade-up"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow" style={{ letterSpacing: "0.22em" }}>
            Accounts receivable
          </p>
          <h3
            className="serif mt-1"
            style={{
              fontSize: 22,
              letterSpacing: "-0.005em",
              lineHeight: 1.1,
            }}
          >
            Outstanding aging
          </h3>
        </div>
        <Link
          to="/invoices"
          className="text-accent"
          style={{ fontSize: 12.5, fontWeight: 500 }}
        >
          Open invoices →
        </Link>
      </div>

      {!hasData ? (
        <div
          className="mt-5 rounded-[6px] p-5 text-center text-muted"
          style={{
            background: "var(--surface-2)",
            border: "1px dashed var(--border)",
            fontSize: 13,
          }}
        >
          <Icon name="invoice" size={20} className="mx-auto opacity-50" />
          <p className="mt-2">
            {emptyHint ??
              "No open invoices. Create one from a completed ride to start tracking AR here."}
          </p>
        </div>
      ) : (
        <>
          <div
            className="serif tnum mt-3"
            style={{ fontSize: 34, letterSpacing: "-0.01em" }}
          >
            {fmtMoney(totalCents)}
          </div>
          <p
            className="text-muted mt-1"
            style={{ fontSize: 12.5 }}
          >
            across {totalCount} open invoice
            {totalCount === 1 ? "" : "s"}
          </p>

          {/* Stacked bar */}
          <div
            className="mt-5 flex overflow-hidden"
            style={{
              height: 10,
              borderRadius: 2,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            {buckets.map((b) =>
              b.totalCents === 0 ? null : (
                <div
                  key={b.key}
                  title={b.label}
                  style={{
                    width: `${(b.totalCents / totalCents) * 100}%`,
                    background: b.color,
                  }}
                />
              ),
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
            {buckets.map((b) => (
              <div key={b.key}>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: b.color,
                    }}
                  />
                  <span className="eyebrow" style={{ letterSpacing: "0.18em" }}>
                    {b.label}
                  </span>
                </div>
                <div
                  className="tnum"
                  style={{ fontSize: 18, fontWeight: 500 }}
                >
                  {fmtMoney(b.totalCents)}
                </div>
                <div
                  className="text-muted tnum"
                  style={{ fontSize: 11 }}
                >
                  {b.count} invoice{b.count === 1 ? "" : "s"}
                </div>
              </div>
            ))}
          </div>

          {oldest.length > 0 ? (
            <>
              <p
                className="eyebrow mt-7 mb-3"
                style={{ letterSpacing: "0.22em" }}
              >
                Oldest open
              </p>
              <div className="flex flex-col">
                {oldest.map((inv) => (
                  <Link
                    key={inv.id}
                    to={inv.ride_id ? `/rides/${inv.ride_id}?tab=invoice` : "/invoices"}
                    className="flex items-center gap-3 py-3 transition"
                    style={{
                      borderTop: "1px solid var(--border)",
                      color: "var(--text)",
                    }}
                  >
                    <div
                      className="tnum text-muted shrink-0"
                      style={{ fontSize: 12, width: 64 }}
                    >
                      #{inv.number ?? "—"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="truncate"
                        style={{ fontSize: 13 }}
                      >
                        Invoice {inv.id.slice(0, 8)}
                      </div>
                      <div
                        className="text-muted tnum"
                        style={{ fontSize: 11 }}
                      >
                        {inv.due_date
                          ? `due ${inv.due_date}`
                          : "no due date"}
                      </div>
                    </div>
                    <div
                      className="tnum text-muted shrink-0"
                      style={{ fontSize: 11.5, width: 80, textAlign: "right" }}
                    >
                      {inv.daysOpen}d open
                    </div>
                    <div
                      className="tnum text-right shrink-0"
                      style={{
                        width: 88,
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {fmtMoney(inv.amount_cents)}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
