// Top clients by booked revenue in the window. Bar-fill rows show
// relative concentration at a glance.

import { fmtMoney } from "../../lib/format";

export type TopClientRow = {
  id: string;
  name: string;
  bookedCents: number;
  earnedCents: number;
  rideCount: number;
};

export function EarningsTopClients({
  rows,
  totalCents,
  showEarned = false,
}: {
  rows: TopClientRow[];
  totalCents: number;
  showEarned?: boolean;
}) {
  const max = rows.length === 0 ? 1 : rows[0].bookedCents || 1;
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
            Concentration
          </p>
          <h3
            className="serif mt-1"
            style={{
              fontSize: 22,
              letterSpacing: "-0.005em",
              lineHeight: 1.1,
            }}
          >
            Top clients
          </h3>
        </div>
      </div>
      <p
        className="text-muted mt-1 mb-5"
        style={{ fontSize: 12.5 }}
      >
        Share of revenue in the selected window.
      </p>

      {rows.length === 0 ? (
        <div
          className="rounded-[6px] p-5 text-center text-muted"
          style={{
            background: "var(--surface-2)",
            border: "1px dashed var(--border)",
            fontSize: 13,
          }}
        >
          No client revenue in this window yet.
        </div>
      ) : (
        <div className="flex flex-col">
          {rows.map((r, i) => {
            const share =
              totalCents > 0
                ? Math.round((r.bookedCents / totalCents) * 100)
                : 0;
            const widthPct = (r.bookedCents / max) * 100;
            return (
              <div
                key={r.id}
                className="relative flex items-center gap-4 py-3"
                style={{
                  borderTop: i === 0 ? "none" : "1px solid var(--border)",
                }}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${widthPct}%`,
                    background:
                      "color-mix(in oklab, var(--accent) 12%, transparent)",
                    borderRight:
                      "1px solid color-mix(in oklab, var(--accent) 30%, transparent)",
                    zIndex: 0,
                  }}
                />
                <span
                  className="tnum text-muted relative z-10 shrink-0"
                  style={{ width: 24, fontSize: 12 }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0 relative z-10">
                  <div
                    className="truncate"
                    style={{ fontSize: 13.5, fontWeight: 500 }}
                  >
                    {r.name}
                  </div>
                  <div
                    className="text-muted tnum"
                    style={{ fontSize: 11.5 }}
                  >
                    {r.rideCount} ride{r.rideCount === 1 ? "" : "s"}
                    {showEarned && r.earnedCents !== r.bookedCents
                      ? ` · ${fmtMoney(r.earnedCents)} earned`
                      : ""}
                  </div>
                </div>
                <div
                  className="tnum text-right relative z-10 shrink-0"
                  style={{ width: 56, fontSize: 13, fontWeight: 500 }}
                >
                  {share}%
                </div>
                <div
                  className="tnum text-right relative z-10 shrink-0"
                  style={{
                    width: 84,
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {fmtMoney(r.bookedCents)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
