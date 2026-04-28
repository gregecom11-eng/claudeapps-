import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listRides } from "../lib/api";
import { fmtDate, fmtTime } from "../lib/format";
import { StatusBadge } from "../components/StatusBadge";
import type { Ride } from "../lib/types";

type Filter = "upcoming" | "past" | "all";

export function Rides() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listRides({ limit: 200 })
      .then((r) => {
        if (cancelled) return;
        setRides(r);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const now = Date.now();
  const filtered = rides.filter((r) => {
    const t = new Date(r.pickup_at).getTime();
    if (filter === "upcoming") return t >= now;
    if (filter === "past") return t < now;
    return true;
  });
  if (filter === "past") filtered.reverse();

  const grouped = groupByDay(filtered);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-semibold tracking-tight">Rides</h1>
        <div className="flex items-center gap-2">
          <FilterChip
            value="upcoming"
            current={filter}
            onClick={() => setFilter("upcoming")}
          />
          <FilterChip
            value="past"
            current={filter}
            onClick={() => setFilter("past")}
          />
          <FilterChip
            value="all"
            current={filter}
            onClick={() => setFilter("all")}
          />
          <Link to="/rides/new" className="btn btn-primary">
            + New
          </Link>
        </div>
      </div>

      {error ? <div className="card text-danger">{error}</div> : null}
      {loading ? <div className="text-muted text-sm">Loading…</div> : null}

      {grouped.length === 0 && !loading ? (
        <div className="card text-muted text-sm">
          No rides match this filter.
        </div>
      ) : null}

      {grouped.map(([day, items]) => (
        <section key={day} className="space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-muted">
            {day}
          </h2>
          <ul className="card divide-y divide-border p-0">
            {items.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/rides/${r.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition"
                >
                  <div className="tabular text-sm font-medium w-16">
                    {fmtTime(r.pickup_at)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {r.passenger_name}
                    </div>
                    <div className="text-xs text-muted truncate">
                      {r.pickup_address}
                      {r.dropoff_address ? ` → ${r.dropoff_address}` : ""}
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FilterChip({
  value,
  current,
  onClick,
}: {
  value: Filter;
  current: Filter;
  onClick: () => void;
}) {
  const active = value === current;
  return (
    <button
      onClick={onClick}
      className={[
        "px-3 py-1.5 rounded-full text-sm capitalize transition",
        active ? "bg-surface-2 text-text" : "text-muted hover:text-text",
      ].join(" ")}
    >
      {value}
    </button>
  );
}

function groupByDay(rides: Ride[]): [string, Ride[]][] {
  const map = new Map<string, Ride[]>();
  for (const r of rides) {
    const day = fmtDate(r.pickup_at);
    map.set(day, [...(map.get(day) ?? []), r]);
  }
  return [...map.entries()];
}
