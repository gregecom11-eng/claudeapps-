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

export function DriverUpcoming() {
  const [rides, setRides] = useState<Ride[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    // Tomorrow 00:00 LA → 30 days out.
    const startOfTomorrowLA = (() => {
      const dayStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: BUSINESS_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(Date.now() + 24 * 60 * 60 * 1000));
      const off = laOffsetFor(new Date());
      return new Date(`${dayStr}T00:00:00${off}`).toISOString();
    })();
    const in30days = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    Promise.all([
      listRides({
        from: startOfTomorrowLA,
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

  const grouped = useMemo(() => groupByLADay(rides ?? []), [rides]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-muted hover:text-text"
          style={{ fontSize: 12.5 }}
        >
          <Icon name="back" size={13} /> Today
        </Link>
        <h1
          className="mt-2"
          style={{
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          Upcoming rides
        </h1>
        <p
          className="text-muted mt-1"
          style={{ fontSize: 13.5, lineHeight: 1.5 }}
        >
          {rides === null
            ? "Loading…"
            : rides.length === 0
            ? "Nothing scheduled past today. You'll see future rides here as they come in."
            : `${rides.length} ${rides.length === 1 ? "ride" : "rides"} on the books across the next 30 days.`}
        </p>
      </div>

      {error ? (
        <div className="surface rounded-[12px] p-4 text-danger text-sm">
          {error}
        </div>
      ) : null}

      {grouped.map(([dayLabel, items]) => (
        <section key={dayLabel}>
          <div className="flex items-center gap-3 mb-3">
            <Icon name="calendar" size={14} className="text-muted" />
            <h2
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {dayLabel}
            </h2>
            <span
              className="text-muted tnum"
              style={{ fontSize: 12 }}
            >
              {items.length} {items.length === 1 ? "ride" : "rides"}
            </span>
            <div
              className="flex-1 h-px"
              style={{ background: "var(--border)" }}
            />
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
    <article className="surface rounded-[12px] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left p-4"
        aria-expanded={open}
      >
        <div className="flex items-center justify-between gap-3">
          <div
            className="tabular"
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            {fmtTime(ride.pickup_at)}
          </div>
          <StatusBadge status={ride.status} />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Avatar name={ride.passenger_name} size={28} />
          <div className="min-w-0 flex-1">
            <div
              className="truncate"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              {ride.passenger_name}
            </div>
            <div
              className="text-muted truncate"
              style={{ fontSize: 12 }}
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
              transition: "transform 180ms",
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

function laDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: BUSINESS_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function groupByLADay(rides: Ride[]): [string, Ride[]][] {
  const sorted = rides
    .slice()
    .sort(
      (a, b) =>
        new Date(a.pickup_at).getTime() - new Date(b.pickup_at).getTime(),
    );
  const map = new Map<string, Ride[]>();
  for (const r of sorted) {
    const day = laDayLabel(r.pickup_at);
    map.set(day, [...(map.get(day) ?? []), r]);
  }
  return [...map.entries()];
}
