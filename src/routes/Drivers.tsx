import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listAllDrivers, listRides } from "../lib/api";
import { fmtMoney } from "../lib/format";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import type { Driver, Ride } from "../lib/types";

export function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listAllDrivers(), listRides({ limit: 500 })])
      .then(([d, r]) => {
        setDrivers(d);
        setRides(r);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      );
  }, []);

  const stats = useMemo(() => {
    const nowMs = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const m = new Map<
      string,
      {
        total: number;
        thisWeek: number;
        revenueWeek: number;
        completed: number;
      }
    >();
    for (const r of rides) {
      if (!r.driver_id) continue;
      const t = new Date(r.pickup_at).getTime();
      const within = nowMs - t < weekMs && nowMs - t > -weekMs;
      const cur = m.get(r.driver_id) ?? {
        total: 0,
        thisWeek: 0,
        revenueWeek: 0,
        completed: 0,
      };
      cur.total += 1;
      if (within) cur.thisWeek += 1;
      if (within && r.status === "completed") cur.revenueWeek += r.total_cents;
      if (r.status === "completed") cur.completed += 1;
      m.set(r.driver_id, cur);
    }
    return m;
  }, [rides]);

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
            Directory
          </div>
          <h1
            className="mt-1"
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            Drivers
          </h1>
          <p
            className="text-muted mt-1"
            style={{ fontSize: 13.5 }}
          >
            Add, deactivate, or send sign-in links from{" "}
            <Link to="/settings" className="text-accent">
              Settings
            </Link>
            .
          </p>
        </div>
      </div>

      {error ? (
        <div className="surface rounded-[12px] p-4 text-danger text-sm">
          {error}
        </div>
      ) : null}

      {drivers.length === 0 ? (
        <div className="surface rounded-[12px] p-8 text-center text-muted text-sm">
          No drivers yet.
        </div>
      ) : (
        <ul className="surface rounded-[12px] divide-y divide-border">
          {drivers.map((d) => {
            const s = stats.get(d.id) ?? {
              total: 0,
              thisWeek: 0,
              revenueWeek: 0,
              completed: 0,
            };
            return (
              <li
                key={d.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ opacity: d.active ? 1 : 0.55 }}
              >
                <Avatar name={d.full_name} size={36} />
                <div className="flex-1 min-w-0">
                  <div
                    className="truncate"
                    style={{ fontSize: 14, fontWeight: 600 }}
                  >
                    {d.full_name.replace(/\s+\(.*\)$/, "")}
                    {!d.active ? (
                      <span
                        className="ml-2 chip"
                        style={{
                          background: "transparent",
                          color: "var(--text-muted)",
                          fontSize: 10.5,
                        }}
                      >
                        Inactive
                      </span>
                    ) : d.profile_id ? (
                      <span
                        className="ml-2 chip"
                        style={{
                          background: "transparent",
                          color: "var(--success)",
                          fontSize: 10.5,
                          borderColor:
                            "color-mix(in oklab, var(--success) 35%, var(--border))",
                        }}
                      >
                        <Icon name="check" size={10} /> Linked
                      </span>
                    ) : null}
                  </div>
                  <div
                    className="text-muted truncate tabular"
                    style={{ fontSize: 12 }}
                  >
                    {d.phone ?? "no phone"}
                    {d.email ? ` · ${d.email}` : ""}
                  </div>
                </div>
                <div className="hidden sm:block text-right">
                  <div
                    className="tabular"
                    style={{ fontSize: 13, fontWeight: 600 }}
                  >
                    {s.thisWeek} this week
                  </div>
                  <div
                    className="text-muted tabular"
                    style={{ fontSize: 11 }}
                  >
                    {s.completed} completed · {fmtMoney(s.revenueWeek)} this week
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
