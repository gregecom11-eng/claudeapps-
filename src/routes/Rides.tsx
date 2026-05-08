import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listDrivers, listRides, listVehicles } from "../lib/api";
import { fmtDate } from "../lib/format";
import { useRideRealtime } from "../lib/realtime";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { RideCard } from "../components/RideCard";
import { RideRowSkeleton } from "../components/Skeleton";
import type { Driver, Ride, Vehicle } from "../lib/types";

type Filter = "upcoming" | "past" | "all";

export function Rides() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    Promise.all([listRides({ limit: 200 }), listDrivers(), listVehicles()])
      .then(([r, d, v]) => {
        setRides(r);
        setDrivers(d);
        setVehicles(v);
        setError(null);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    reload();
  }, []);

  useRideRealtime(reload);

  const driversById = useMemo(
    () => new Map(drivers.map((d) => [d.id, d])),
    [drivers],
  );
  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles],
  );

  const now = Date.now();
  const q = query.trim().toLowerCase();
  const filtered = rides.filter((r) => {
    const t = new Date(r.pickup_at).getTime();
    if (filter === "upcoming" && t < now) return false;
    if (filter === "past" && t >= now) return false;
    if (q) {
      const hay = [
        r.passenger_name,
        r.passenger_phone ?? "",
        r.pickup_address,
        r.dropoff_address ?? "",
        r.notes ?? "",
        r.flight_number ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  if (filter === "past") filtered.reverse();

  const grouped = groupByDay(filtered);

  return (
    <div>
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
            All rides
          </div>
          <h1
            className="mt-1"
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            Rides
          </h1>
        </div>
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
          <Link to="/rides/new">
            <Button variant="primary" icon="plus">
              Add
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="mt-5 relative">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          style={{ pointerEvents: "none" }}
        >
          <Icon name="search" size={14} />
        </span>
        <input
          className="field field-prefixed"
          placeholder="Search by passenger, address, flight, notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-grid place-items-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              color: "var(--text-muted)",
            }}
          >
            <Icon name="x" size={12} />
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 surface rounded-[12px] p-4 text-danger text-sm">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="mt-6 flex flex-col gap-3">
          <RideRowSkeleton />
          <RideRowSkeleton />
          <RideRowSkeleton />
        </div>
      ) : null}

      {!loading && grouped.length === 0 ? (
        <div className="mt-6 surface rounded-[12px] p-8 text-center text-muted text-sm">
          {query
            ? `No rides match "${query}".`
            : "No rides match this filter."}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-7">
        {grouped.map(([day, items]) => (
          <section key={day}>
            <div className="flex items-center gap-3 mb-3">
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {day}
              </h3>
              <span className="text-muted tnum" style={{ fontSize: 12 }}>
                {items.length} {items.length === 1 ? "ride" : "rides"}
              </span>
              <div
                className="flex-1 h-px"
                style={{ background: "var(--border)" }}
              />
            </div>
            <div className="flex flex-col gap-3">
              {items.map((r) => (
                <RideCard
                  key={r.id}
                  ride={r}
                  driver={r.driver_id ? driversById.get(r.driver_id) : null}
                  vehicle={
                    r.vehicle_id ? vehiclesById.get(r.vehicle_id) : null
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </div>
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
      className="inline-flex items-center h-8 px-3 rounded-[8px] text-[13px] capitalize transition"
      style={{
        color: active ? "var(--text)" : "var(--text-muted)",
        background: active ? "var(--surface-2)" : "transparent",
        border: active ? "1px solid var(--border)" : "1px solid transparent",
        fontWeight: active ? 600 : 500,
      }}
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
