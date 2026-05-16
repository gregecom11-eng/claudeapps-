// Vehicle profitability: shows revenue + utilization per vehicle, but
// only as a partial picture until the expense system (fuel + maintenance
// tables) lands. Renders an explicit "needs setup" hint so users
// understand which numbers are real vs missing.

import { fmtMoney } from "../../lib/format";
import { Icon } from "../Icon";

export type VehicleProfRow = {
  id: string;
  name: string;
  plate: string | null;
  rideCount: number;
  revenueCents: number;
  utilization: number; // 0..1 — share of period the vehicle was assigned
};

export function EarningsVehicleProf({
  rows,
}: {
  rows: VehicleProfRow[];
}) {
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
            Fleet
          </p>
          <h3
            className="serif mt-1"
            style={{
              fontSize: 22,
              letterSpacing: "-0.005em",
              lineHeight: 1.1,
            }}
          >
            Vehicle profitability
          </h3>
        </div>
      </div>
      <p
        className="text-muted mt-1.5 mb-5"
        style={{ fontSize: 12.5 }}
      >
        Revenue per vehicle in this window. Fuel + maintenance arrive when the expenses page ships.
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
          No vehicle activity in this window.
        </div>
      ) : (
        <div className="grid gap-4">
          {rows.map((v) => (
            <div
              key={v.id}
              className="rounded-[6px] p-5"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                <div className="min-w-0">
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                    className="truncate"
                  >
                    {v.name}
                  </div>
                  <div
                    className="text-muted tnum"
                    style={{ fontSize: 11.5 }}
                  >
                    {v.plate ? `Plate ${v.plate} · ` : ""}
                    {v.rideCount} ride{v.rideCount === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="serif tnum"
                    style={{
                      fontSize: 22,
                      lineHeight: 1,
                      color: "var(--accent)",
                    }}
                  >
                    {fmtMoney(v.revenueCents)}
                  </div>
                  <div
                    className="text-muted"
                    style={{ fontSize: 11 }}
                  >
                    Revenue
                  </div>
                </div>
              </div>

              <div className="mb-1.5 flex items-center justify-between">
                <span
                  className="eyebrow"
                  style={{ letterSpacing: "0.22em" }}
                >
                  Utilization
                </span>
                <span
                  className="tnum"
                  style={{ fontSize: 12, fontWeight: 500 }}
                >
                  {Math.round(v.utilization * 100)}%
                </span>
              </div>
              <div
                className="overflow-hidden"
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.max(0, v.utilization * 100))}%`,
                    height: "100%",
                    background:
                      v.utilization > 0.7
                        ? "var(--success)"
                        : v.utilization > 0.4
                          ? "var(--accent)"
                          : "var(--warn)",
                  }}
                />
              </div>

              <div
                className="mt-4 rounded-[4px] p-3 flex items-start gap-2"
                style={{
                  background:
                    "color-mix(in oklab, var(--accent) 5%, transparent)",
                  border: "1px dashed var(--border)",
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                <Icon name="info" size={13} className="shrink-0 mt-0.5" />
                <span>
                  Fuel and maintenance need the expenses page. Profit per vehicle will fill in automatically once those are tracked.
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
