// Vehicle profitability: revenue, utilization, fuel, maintenance, and
// the net that's left for the company. Fuel reads from ride_costs
// (gas category) for rides on that vehicle. Maintenance reads from
// vehicle_maintenance with amortization applied.

import { fmtMoney } from "../../lib/format";

export type VehicleProfRow = {
  id: string;
  name: string;
  plate: string | null;
  rideCount: number;
  revenueCents: number;
  fuelCents: number;          // actuals + fallback to estimate
  maintenanceCents: number;   // amortized into window
  fixedCents: number;         // fixed expenses tagged to this vehicle
  utilization: number;        // 0..1 — share of period the vehicle was assigned
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
          {rows.map((v) => {
            const totalCost = v.fuelCents + v.maintenanceCents + v.fixedCents;
            const net = v.revenueCents - totalCost;
            const margin =
              v.revenueCents > 0 ? net / v.revenueCents : 0;
            return (
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
                        color:
                          net >= 0
                            ? "var(--success)"
                            : "var(--danger)",
                      }}
                    >
                      {fmtMoney(net)}
                    </div>
                    <div
                      className="text-muted"
                      style={{ fontSize: 11 }}
                    >
                      Net · {Math.round(margin * 100)}% margin
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  <Stat label="Revenue" value={fmtMoney(v.revenueCents)} />
                  <Stat
                    label="Fuel"
                    value={fmtMoney(v.fuelCents)}
                    muted={v.fuelCents === 0}
                  />
                  <Stat
                    label="Maintenance"
                    value={fmtMoney(v.maintenanceCents)}
                    muted={v.maintenanceCents === 0}
                  />
                  <Stat
                    label="Fixed allocated"
                    value={fmtMoney(v.fixedCents)}
                    muted={v.fixedCents === 0}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div>
      <div
        className="eyebrow"
        style={{ letterSpacing: "0.22em" }}
      >
        {label}
      </div>
      <div
        className="tnum mt-1"
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: muted ? "var(--text-muted)" : "var(--text)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
