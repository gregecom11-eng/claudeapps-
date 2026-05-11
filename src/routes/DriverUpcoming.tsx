import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listRides, listVehicles } from "../lib/api";
import { BUSINESS_TZ, fmtTime } from "../lib/format";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { StatusBadge } from "../components/StatusBadge";
import type { Ride, Vehicle } from "../lib/types";

// Driver "Upcoming" view: every future ride assigned to this driver
// (RLS scopes the query to driver_id = current_driver_id()), grouped
// by day. Read-only — actionable buttons (On my way / Arrived /
// Completed) live on Today. Drivers come here to plan ahead.

type FilterKey = "all" | "airport" | "this_week" | "no_vehicle";

export function DriverUpcoming() {
  const [rides, setRides] = useState<Ride[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    // Start at 00:00 LA *today* so today's remaining rides surface in a
    // dedicated "Today" group (status filter below removes already-done
    // ones). Window: today → 30 days out.
    const startOfTodayLA = (() => {
      const dayStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: BUSINESS_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const off = laOffsetFor(new Date());
      return new Date(`${dayStr}T00:00:00${off}`).toISOString();
    })();
    const in30days = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    Promise.all([
      listRides({
        from: startOfTodayLA,
        to: in30days,
        limit: 200,
      }),
      listVehicles(),
    ])
      .then(([r, v]) => {
        // RLS already scopes; also filter out completed/cancelled in case.
        const upcoming = r.filter(
          (x) => x.status !== "completed" && x.status !== "cancelled",
        );
        setRides(upcoming);
        setVehicles(v);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      );
  }, []);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles],
  );

  const weekEnd = useMemo(() => endOfThisWeekLA(), []);

  const counts = useMemo(() => {
    const all = rides ?? [];
    return {
      all: all.length,
      airport: all.filter(rideIsAirport).length,
      this_week: all.filter((r) => new Date(r.pickup_at) <= weekEnd).length,
      no_vehicle: all.filter((r) => !r.vehicle_id).length,
    };
  }, [rides, weekEnd]);

  const filtered = useMemo(() => {
    const all = rides ?? [];
    if (filter === "airport") return all.filter(rideIsAirport);
    if (filter === "this_week")
      return all.filter((r) => new Date(r.pickup_at) <= weekEnd);
    if (filter === "no_vehicle") return all.filter((r) => !r.vehicle_id);
    return all;
  }, [rides, filter, weekEnd]);

  const grouped = useMemo(() => groupByLADay(filtered), [filtered]);

  const weekRides = useMemo(
    () => (rides ?? []).filter((r) => new Date(r.pickup_at) <= weekEnd),
    [rides, weekEnd],
  );

  return (
    <div className="space-y-7">
      <div className="fade-up">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-muted hover:text-text transition"
          style={{ fontSize: 12.5 }}
        >
          <Icon name="back" size={13} /> Today
        </Link>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <div className="eyebrow">Schedule</div>
            <h1
              className="serif mt-1.5"
              style={{
                fontSize: 32,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
              }}
            >
              Upcoming
            </h1>
          </div>
          {weekRides.length >= 2 ? (
            <a
              href={multiStopMapsUrl(weekRides)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[12px] h-11 px-4 shrink-0 transition active:scale-[0.97]"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text)",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
              title="Open every pickup this week as a single Google Maps route"
            >
              <Icon name="pin" size={13} /> Map week
            </a>
          ) : null}
        </div>
        <p
          className="text-muted mt-2"
          style={{ fontSize: 14, lineHeight: 1.55 }}
        >
          {rides === null
            ? "Loading…"
            : rides.length === 0
            ? "Nothing scheduled. You'll see assigned rides here as dispatch books them in."
            : `${rides.length} ${
                rides.length === 1 ? "ride" : "rides"
              } on the books across the next 30 days.`}
        </p>
      </div>

      {error ? (
        <div
          className="rounded-[14px] p-4 text-sm"
          style={{
            background: "color-mix(in oklab, var(--danger) 12%, var(--surface))",
            border: "1px solid color-mix(in oklab, var(--danger) 28%, var(--border))",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      ) : null}

      {rides && rides.length > 0 ? (
        <FilterPills value={filter} counts={counts} onChange={setFilter} />
      ) : null}

      {rides && rides.length > 0 && filtered.length === 0 ? (
        <div
          className="surface rounded-[14px] p-6 text-center text-muted"
          style={{ fontSize: 14 }}
        >
          No rides match this filter.
        </div>
      ) : null}

      {grouped.map(({ key, label, items }) => (
        <section key={key} className="fade-up">
          <div className="flex items-center gap-3 mb-4">
            <span
              className="inline-grid place-items-center text-accent"
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: "var(--accent-soft)",
                border: "1px solid color-mix(in oklab, var(--accent) 24%, var(--border))",
              }}
            >
              <Icon name="calendar" size={13} />
            </span>
            <h2 className="eyebrow" style={{ fontSize: 11.5 }}>
              {label}
            </h2>
            <span className="text-muted tnum" style={{ fontSize: 12 }}>
              {items.length} {items.length === 1 ? "ride" : "rides"}
            </span>
            <div className="flex-1 hr-fine" />
            {items.length >= 2 ? (
              <a
                href={multiStopMapsUrl(items)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-accent shrink-0"
                style={{ fontSize: 12, fontWeight: 600 }}
                title="Open all of this day's pickups in Google Maps"
              >
                <Icon name="pin" size={12} /> Plan day
              </a>
            ) : null}
          </div>
          <ul className="space-y-3">
            {items.map((r) => {
              const v = r.vehicle_id ? vehiclesById.get(r.vehicle_id) : null;
              const open = expanded === r.id;
              return (
                <li key={r.id}>
                  <UpcomingRideCard
                    ride={r}
                    vehicle={v ?? null}
                    open={open}
                    onToggle={() => setExpanded(open ? null : r.id)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ── Filter pills ────────────────────────────────────────────────── */
function FilterPills({
  value,
  counts,
  onChange,
}: {
  value: FilterKey;
  counts: Record<FilterKey, number>;
  onChange: (k: FilterKey) => void;
}) {
  const opts: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "this_week", label: "This week" },
    { key: "airport", label: "Airport" },
    { key: "no_vehicle", label: "No vehicle" },
  ];
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1" role="tablist">
      {opts.map((o) => {
        const active = value === o.key;
        const n = counts[o.key];
        const disabled = !active && n === 0;
        return (
          <button
            key={o.key}
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(o.key)}
            className="shrink-0 inline-flex items-center gap-2 transition active:scale-[0.97]"
            style={{
              cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.4 : 1,
              height: 38,
              padding: "0 16px",
              borderRadius: 999,
              background: active ? "var(--accent)" : "transparent",
              color: active ? "#15161B" : "var(--text)",
              border: `1px solid ${
                active ? "var(--accent-strong)" : "var(--border)"
              }`,
              fontWeight: active ? 600 : 500,
              fontSize: 13,
              whiteSpace: "nowrap",
              boxShadow: active
                ? "0 4px 12px color-mix(in oklab, var(--accent) 30%, transparent)"
                : "none",
            }}
          >
            {o.label}
            <span
              className="tnum"
              style={{
                fontSize: 11,
                fontWeight: 600,
                opacity: 0.75,
                padding: "1px 6px",
                borderRadius: 999,
                background: active
                  ? "rgba(0,0,0,0.12)"
                  : "var(--surface-2)",
                lineHeight: 1.4,
              }}
            >
              {n}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Card with inline-expandable briefing ────────────────────────── */
function UpcomingRideCard({
  ride,
  vehicle,
  open,
  onToggle,
}: {
  ride: Ride;
  vehicle: Vehicle | null;
  open: boolean;
  onToggle: () => void;
}) {
  const mapsUrl = (addr: string) =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;

  return (
    <article
      className="rounded-[16px] overflow-hidden transition"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: open ? "var(--shadow-md)" : "var(--shadow-sm)",
      }}
    >
      <button
        onClick={onToggle}
        className="w-full text-left p-5 transition active:scale-[0.998]"
        aria-expanded={open}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div
              className="display-num"
              style={{
                fontSize: 30,
                color: "var(--text)",
              }}
            >
              {fmtTime(ride.pickup_at)}
            </div>
            <div
              className="text-muted tnum"
              style={{
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontWeight: 500,
                marginTop: 4,
              }}
            >
              pickup
            </div>
          </div>
          <StatusBadge status={ride.status} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Avatar name={ride.passenger_name} size={32} />
          <div className="min-w-0 flex-1">
            <div
              className="truncate"
              style={{ fontSize: 14.5, fontWeight: 600 }}
            >
              {ride.passenger_name}
            </div>
            <div
              className="text-muted truncate"
              style={{ fontSize: 12.5, marginTop: 1, lineHeight: 1.4 }}
            >
              {ride.pickup_address}
              {ride.dropoff_address ? ` → ${ride.dropoff_address}` : ""}
            </div>
          </div>
          <span
            className="text-muted shrink-0"
            style={{
              display: "inline-flex",
              transform: open ? "rotate(90deg)" : "rotate(0)",
              transition: "transform 200ms",
            }}
          >
            <Icon name="chev" size={14} />
          </span>
        </div>
      </button>

      {open ? (
        <div
          className="p-4 space-y-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {ride.passenger_phone ? (
            <a
              href={`tel:${ride.passenger_phone}`}
              className="w-full inline-flex items-center justify-center gap-2 rounded-[10px] h-10 text-[13.5px] font-medium"
              style={{
                background:
                  "color-mix(in oklab, var(--success) 18%, var(--surface))",
                color: "var(--success)",
                border:
                  "1px solid color-mix(in oklab, var(--success) 50%, var(--border))",
              }}
            >
              <Icon name="phone" size={14} /> Call passenger
            </a>
          ) : null}

          <DetailRow icon="pin" label="Pickup">
            {ride.pickup_address}
            <div className="mt-1.5">
              <a
                href={mapsUrl(ride.pickup_address)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-accent"
                style={{ fontSize: 12.5, fontWeight: 500 }}
              >
                Open in Maps <Icon name="arrow" size={11} />
              </a>
            </div>
          </DetailRow>

          {ride.dropoff_address ? (
            <DetailRow icon="flag" label="Dropoff">
              {ride.dropoff_address}
              <div className="mt-1.5">
                <a
                  href={mapsUrl(ride.dropoff_address)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-accent"
                  style={{ fontSize: 12.5, fontWeight: 500 }}
                >
                  Open in Maps <Icon name="arrow" size={11} />
                </a>
              </div>
            </DetailRow>
          ) : null}

          {ride.flight_number || ride.flight_airline ? (
            <DetailRow icon="plane" label="Flight">
              <span className="tnum">
                {ride.flight_airline ?? ""} {ride.flight_number ?? ""}
                {ride.flight_airport ? ` · ${ride.flight_airport}` : ""}
                {ride.flight_terminal ? ` T${ride.flight_terminal}` : ""}
              </span>
            </DetailRow>
          ) : null}

          {vehicle ? (
            <DetailRow icon="car" label="Vehicle">
              <span className="tnum">
                {vehicle.display_name}
                {vehicle.plate ? ` · ${vehicle.plate}` : ""}
              </span>
            </DetailRow>
          ) : null}

          {ride.notes ? (
            <DetailRow icon="info" label="Dispatch notes">
              <span style={{ whiteSpace: "pre-wrap" }}>{ride.notes}</span>
            </DetailRow>
          ) : null}

          <div
            className="text-muted"
            style={{ fontSize: 11.5, lineHeight: 1.5 }}
          >
            On the day of the ride, this will move to <strong>Today</strong>{" "}
            with the action buttons (On my way · Arrived · etc.).
          </div>
        </div>
      ) : null}
    </article>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: import("../components/Icon").IconName;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted shrink-0 mt-0.5">
        <Icon name={icon} size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <div
          className="text-muted"
          style={{
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 13.5, marginTop: 2 }}>{children}</div>
      </div>
    </div>
  );
}

/* ── Day-grouping in LA timezone ──────────────────────────────── */
function laOffsetFor(d: Date): string {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    timeZoneName: "longOffset",
  })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value;
  return part?.replace("GMT", "") || "+00:00";
}

// End of "this week" in LA — Sunday 23:59:59 (US default week ending).
// Used both for the "This week" pill and the week-level map button.
function endOfThisWeekLA(): Date {
  const now = new Date();
  const dayName = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    weekday: "long",
  }).format(now);
  const idx: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };
  const daysLeft = (7 - (idx[dayName] ?? 0)) % 7;
  const target = new Date(now.getTime() + daysLeft * 24 * 60 * 60 * 1000);
  const dayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(target);
  const off = laOffsetFor(now);
  return new Date(`${dayStr}T23:59:59.999${off}`);
}

// "2026-05-09" in LA — used as a stable bucket key.
function laDayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function laDayPretty(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: BUSINESS_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

type DayGroup = { key: string; label: string; items: Ride[] };

function groupByLADay(rides: Ride[]): DayGroup[] {
  const sorted = rides
    .slice()
    .sort(
      (a, b) =>
        new Date(a.pickup_at).getTime() - new Date(b.pickup_at).getTime(),
    );
  const todayKey = laDayKey(new Date().toISOString());
  const tomorrowKey = laDayKey(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  );
  const map = new Map<string, Ride[]>();
  for (const r of sorted) {
    const key = laDayKey(r.pickup_at);
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return [...map.entries()].map(([key, items]) => {
    const label =
      key === todayKey
        ? "Today"
        : key === tomorrowKey
        ? "Tomorrow"
        : laDayPretty(items[0].pickup_at);
    return { key, label, items };
  });
}

/* ── Helpers: airport detection + multi-stop maps URL ──────────── */
function rideIsAirport(r: Ride): boolean {
  if (r.flight_number || r.flight_airline || r.flight_airport) return true;
  const blob = `${r.pickup_address ?? ""} ${r.dropoff_address ?? ""}`.toLowerCase();
  // Common LA airport hints — picks up "LAX", "Burbank Airport",
  // "Long Beach Airport", "Hollywood Burbank", "Van Nuys", and the
  // generic "airport" / "terminal" tokens.
  return /\b(lax|bur|lgb|sna|ont|van nuys|airport|terminal)\b/.test(blob);
}

// Google Maps multi-stop directions: origin = first pickup,
// destination = last pickup, waypoints = everything in between (by time).
// Driver gets one tap to see the day's run as a single route.
function multiStopMapsUrl(rides: Ride[]): string {
  const stops = rides
    .slice()
    .sort(
      (a, b) =>
        new Date(a.pickup_at).getTime() - new Date(b.pickup_at).getTime(),
    )
    .map((r) => r.pickup_address)
    .filter((a): a is string => !!a && a.trim().length > 0);
  if (stops.length === 0) return "https://www.google.com/maps";
  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(1, -1);
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
  });
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
