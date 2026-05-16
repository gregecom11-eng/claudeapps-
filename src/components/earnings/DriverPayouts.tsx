// Driver economics: per driver, what they grossed (completed rides),
// what the owner kept (commission share), and what flowed to the driver.
// Highlights the owner row separately so "myself driving for myself" is
// distinguished from "what someone else drove for me."

import { fmtMoney } from "../../lib/format";

export type DriverPayoutRow = {
  id: string;
  name: string;
  isOwner: boolean;
  commissionBps: number;
  rideCount: number;
  grossCents: number;
  ownerShareCents: number; // what the owner keeps (full total if owner row)
};

export function EarningsDriverPayouts({
  rows,
}: {
  rows: DriverPayoutRow[];
}) {
  const totals = rows.reduce(
    (a, r) => ({
      rides: a.rides + r.rideCount,
      gross: a.gross + r.grossCents,
      ownerShare: a.ownerShare + r.ownerShareCents,
    }),
    { rides: 0, gross: 0, ownerShare: 0 },
  );
  const totalToDriver = totals.gross - totals.ownerShare;

  return (
    <div
      className="rounded-[6px] p-5 md:p-6 fade-up"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div>
        <p className="eyebrow" style={{ letterSpacing: "0.22em" }}>
          Payouts
        </p>
        <h3
          className="serif mt-1"
          style={{
            fontSize: 22,
            letterSpacing: "-0.005em",
            lineHeight: 1.1,
          }}
        >
          Driver economics
        </h3>
        <p
          className="text-muted mt-1.5 mb-5"
          style={{ fontSize: 12.5 }}
        >
          Gross revenue per driver and the owner's commission share. Owner-driven rides count fully toward your income.
        </p>
      </div>

      {rows.length === 0 ? (
        <div
          className="rounded-[6px] p-5 text-center text-muted"
          style={{
            background: "var(--surface-2)",
            border: "1px dashed var(--border)",
            fontSize: 13,
          }}
        >
          No completed rides with assigned drivers in this window.
        </div>
      ) : (
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
                <th className="pb-3 pr-4">Driver</th>
                <th className="pb-3 pr-4 text-right">Rides</th>
                <th className="pb-3 pr-4 text-right">Gross</th>
                <th className="pb-3 pr-4 text-right">Commission</th>
                <th className="pb-3 pr-4 text-right">To owner</th>
                <th className="pb-3 text-right">To driver</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const toDriver = r.grossCents - r.ownerShareCents;
                const pct = r.commissionBps / 100;
                return (
                  <tr
                    key={r.id}
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <td className="py-3 pr-4">
                      <div
                        style={{ fontWeight: 500 }}
                        className="flex items-center gap-2"
                      >
                        {r.name}
                        {r.isOwner ? (
                          <span
                            style={{
                              fontSize: 10.5,
                              letterSpacing: "0.16em",
                              textTransform: "uppercase",
                              padding: "1px 6px",
                              borderRadius: 3,
                              background: "var(--accent-soft)",
                              color: "var(--accent-strong)",
                              fontWeight: 600,
                            }}
                          >
                            Owner
                          </span>
                        ) : null}
                      </div>
                      <div
                        className="text-muted tnum"
                        style={{ fontSize: 11 }}
                      >
                        {r.rideCount > 0
                          ? `${fmtMoney(r.grossCents / r.rideCount)}/ride`
                          : "—"}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right tnum">{r.rideCount}</td>
                    <td className="py-3 pr-4 text-right tnum">
                      {fmtMoney(r.grossCents)}
                    </td>
                    <td className="py-3 pr-4 text-right tnum text-muted">
                      {r.isOwner ? "—" : `${pct.toFixed(0)}%`}
                    </td>
                    <td
                      className="py-3 pr-4 text-right tnum"
                      style={{ color: "var(--accent)", fontWeight: 500 }}
                    >
                      {fmtMoney(r.ownerShareCents)}
                    </td>
                    <td className="py-3 text-right tnum text-muted">
                      {r.isOwner ? "—" : fmtMoney(toDriver)}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid var(--text)" }}>
                <td
                  className="pt-4 pr-4"
                  style={{ fontWeight: 600 }}
                >
                  Total
                </td>
                <td
                  className="pt-4 pr-4 text-right tnum"
                  style={{ fontWeight: 600 }}
                >
                  {totals.rides}
                </td>
                <td
                  className="pt-4 pr-4 text-right tnum"
                  style={{ fontWeight: 600 }}
                >
                  {fmtMoney(totals.gross)}
                </td>
                <td className="pt-4 pr-4 text-right tnum text-muted">—</td>
                <td
                  className="pt-4 pr-4 text-right tnum"
                  style={{ fontWeight: 600, color: "var(--accent)" }}
                >
                  {fmtMoney(totals.ownerShare)}
                </td>
                <td
                  className="pt-4 text-right tnum text-muted"
                >
                  {fmtMoney(totalToDriver)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
