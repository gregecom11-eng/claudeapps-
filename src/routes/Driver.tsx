import { useEffect, useMemo, useState } from "react";
import {
  claimDriverByEmail,
  listRides,
  listVehicles,
  updateRideStatus,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { BUSINESS_TZ, fmtDate, fmtTime } from "../lib/format";
import { Avatar } from "../components/Avatar";
import { Icon, type IconName } from "../components/Icon";
import { StatusBadge } from "../components/StatusBadge";
import type { Driver, Ride, RideStatus, Vehicle } from "../lib/types";

type Bucket = "Morning" | "Afternoon" | "Evening";

function bucketOf(iso: string): Bucket {
  const h = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: BUSINESS_TZ,
      hour: "numeric",
      hour12: false,
    }).format(new Date(iso)),
    10,
  );
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

function laOffsetFor(d: Date): string {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    timeZoneName: "longOffset",
  })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value;
  return part?.replace("GMT", "") || "+00:00";
}
function laDayBoundsFor(d = new Date()): { from: string; to: string } {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const off = laOffsetFor(d);
  return {
    from: new Date(`${day}T00:00:00${off}`).toISOString(),
    to: new Date(`${day}T23:59:59.999${off}`).toISOString(),
  };
}

export function Driver() {
  const { session } = useAuth();
  const [linked, setLinked] = useState<Driver | null | "loading">("loading");
  const [today, setToday] = useState<Ride[] | null>(null);
  const [tomorrow, setTomorrow] = useState<Ride[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);

  // 1) Link drivers row to current user (idempotent).
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    claimDriverByEmail()
      .then((d) => {
        if (!cancelled) setLinked(d);
      })
      .catch((e) => {
        if (!cancelled) {
          setLinked(null);
          setError(e instanceof Error ? e.message : "Driver linking failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // 2) Load today + tomorrow + vehicles. RLS scopes rides to this driver.
  const reload = () => {
    const todayWindow = laDayBoundsFor();
    const tomorrowWindow = laDayBoundsFor(
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    );
    Promise.all([
      listRides(todayWindow),
      listRides({ ...tomorrowWindow, limit: 5 }),
      listVehicles(),
    ])
      .then(([t, tm, v]) => {
        setToday(t);
        setTomorrow(tm);
        setVehicles(v);
        setError(null);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      );
  };
  useEffect(() => {
    if (linked === "loading") return;
    reload();
  }, [linked]);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles],
  );

  if (linked === "loading") {
    return <div className="text-muted">Loading…</div>;
  }

  if (!linked) {
    return (
      <div className="space-y-4">
        <h1
          style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          You're signed in
        </h1>
        <div
          className="surface rounded-[12px] p-5 text-sm space-y-3"
          style={{ lineHeight: 1.55 }}
        >
          <p>
            But your driver record isn't linked yet. Ask your dispatcher to
            add you under <strong>Settings → Drivers</strong> with this exact
            email:
          </p>
          <code
            className="block rounded-[8px] px-3 py-2"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              fontSize: 13,
              wordBreak: "break-all",
            }}
          >
            {session?.user?.email}
          </code>
          <p className="text-muted">
            Once they save, refresh this page and you'll see your day.
          </p>
        </div>
        {error ? (
          <div className="text-danger text-sm">{error}</div>
        ) : null}
      </div>
    );
  }

  const groups = groupByBucket(today ?? []);

  return (
    <div className="space-y-6">
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
          {new Date().toLocaleDateString("en-US", {
            timeZone: BUSINESS_TZ,
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>
        <h1
          className="mt-1"
          style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          {firstName(linked.full_name)}'s day
        </h1>
        <p
          className="text-muted mt-1"
          style={{ fontSize: 13.5, lineHeight: 1.5 }}
        >
          {today === null
            ? "Loading…"
            : today.length === 0
            ? "Nothing on the books today. Enjoy a quiet morning."
            : `${today.length} ${today.length === 1 ? "ride" : "rides"} assigned to you today.`}
        </p>
      </div>

      {error ? (
        <div className="surface rounded-[12px] p-4 text-danger text-sm">
          {error}
        </div>
      ) : null}

      {today && today.length > 0 ? (
        <div className="space-y-7">
          {(["Morning", "Afternoon", "Evening"] as const).map((b) => {
            const items = groups[b];
            if (items.length === 0) return null;
            return (
              <section key={b}>
                <div className="flex items-center gap-3 mb-3">
                  <Icon
                    name={b === "Morning" ? "sun" : b === "Evening" ? "moon2" : "spark"}
                    size={14}
                    className="text-muted"
                  />
                  <h2
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {b}
                  </h2>
                  <div
                    className="flex-1 h-px"
                    style={{ background: "var(--border)" }}
                  />
                </div>
                <ul className="space-y-3">
                  {items.map((r) => (
                    <li key={r.id}>
                      <DriverRideCard
                        ride={r}
                        vehicle={
                          r.vehicle_id ? vehiclesById.get(r.vehicle_id) : null
                        }
                        onTap={() => setActiveRide(r)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}

      {tomorrow.length > 0 ? (
        <section className="pt-4">
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
              Tomorrow preview
            </h2>
            <div
              className="flex-1 h-px"
              style={{ background: "var(--border)" }}
            />
          </div>
          <ul className="surface rounded-[12px] divide-y divide-border">
            {tomorrow.map((r) => (
              <li key={r.id} className="px-4 py-3 flex items-center gap-3">
                <div className="tabular text-sm font-medium w-16">
                  {fmtTime(r.pickup_at)}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="truncate"
                    style={{ fontSize: 13.5, fontWeight: 500 }}
                  >
                    {r.passenger_name}
                  </div>
                  <div
                    className="text-muted truncate"
                    style={{ fontSize: 12 }}
                  >
                    {r.pickup_address}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activeRide ? (
        <RideSheet
          ride={activeRide}
          vehicle={
            activeRide.vehicle_id
              ? vehiclesById.get(activeRide.vehicle_id) ?? null
              : null
          }
          onClose={() => setActiveRide(null)}
          onStatus={async (status) => {
            try {
              await updateRideStatus(activeRide.id, status);
              setActiveRide({ ...activeRide, status });
              reload();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Update failed");
            }
          }}
        />
      ) : null}
    </div>
  );
}

/* ── Compact ride card (no $$ shown) ───────────────────────────── */
function DriverRideCard({
  ride,
  vehicle,
  onTap,
}: {
  ride: Ride;
  vehicle: Vehicle | null | undefined;
  onTap: () => void;
}) {
  const isLive = ride.status === "in_progress";
  return (
    <button
      onClick={onTap}
      className="w-full text-left surface rounded-[12px] p-4 transition"
      style={{
        boxShadow: isLive ? "0 0 0 1px var(--accent)" : undefined,
        background: isLive
          ? "color-mix(in oklab, var(--accent) 6%, var(--surface))"
          : undefined,
      }}
    >
      <header className="flex items-center justify-between gap-3">
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
      </header>
      <div className="mt-2 flex items-center gap-3">
        <Avatar name={ride.passenger_name} size={28} />
        <div className="min-w-0 flex-1">
          <div
            className="truncate"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            {ride.passenger_name}
          </div>
          <div className="text-muted truncate" style={{ fontSize: 12 }}>
            {ride.pickup_address}
            {ride.dropoff_address ? ` → ${ride.dropoff_address}` : ""}
          </div>
        </div>
      </div>
      {vehicle ? (
        <div
          className="mt-2 inline-flex items-center gap-1.5 text-muted"
          style={{ fontSize: 12 }}
        >
          <Icon name="car" size={12} />
          <span className="tnum">
            {vehicle.display_name}
            {vehicle.plate ? ` · ${vehicle.plate}` : ""}
          </span>
        </div>
      ) : null}
    </button>
  );
}

/* ── Full ride briefing sheet ──────────────────────────────────── */
function RideSheet({
  ride,
  vehicle,
  onClose,
  onStatus,
}: {
  ride: Ride;
  vehicle: Vehicle | null;
  onClose: () => void;
  onStatus: (status: RideStatus) => void;
}) {
  const next: RideStatus | null =
    ride.status === "scheduled" || ride.status === "requested"
      ? "in_progress"
      : ride.status === "in_progress"
      ? "completed"
      : null;
  const nextLabel =
    next === "in_progress"
      ? "On my way"
      : next === "completed"
      ? "Mark completed"
      : null;

  const mapsUrl = (addr: string) =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end md:items-center justify-center"
      style={{ background: "color-mix(in oklab, #000 50%, transparent)" }}
      onClick={onClose}
    >
      <div
        className="surface rounded-t-[16px] md:rounded-[16px] w-full md:max-w-[520px] max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        <div
          className="px-5 pt-4 pb-3 flex items-start justify-between gap-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="min-w-0">
            <div
              className="text-muted tabular"
              style={{ fontSize: 12.5 }}
            >
              {fmtDate(ride.pickup_at)} · {fmtTime(ride.pickup_at)}
            </div>
            <h2
              className="truncate"
              style={{
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              {ride.passenger_name}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-grid place-items-center"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {ride.passenger_phone ? (
            <a
              href={`tel:${ride.passenger_phone}`}
              className="w-full inline-flex items-center justify-center gap-2 rounded-[10px] h-12 text-[15px] font-semibold"
              style={{
                background:
                  "color-mix(in oklab, var(--success) 22%, var(--surface))",
                color: "var(--success)",
                border:
                  "1px solid color-mix(in oklab, var(--success) 50%, var(--border))",
              }}
            >
              <Icon name="phone" size={16} /> Call {firstName(ride.passenger_name)}
            </a>
          ) : null}

          <SheetRow icon="pin" label="Pickup">
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
          </SheetRow>

          {ride.dropoff_address ? (
            <SheetRow icon="flag" label="Dropoff">
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
            </SheetRow>
          ) : null}

          {ride.flight_number || ride.flight_airline ? (
            <SheetRow icon="plane" label="Flight">
              <span className="tnum">
                {ride.flight_airline ?? ""} {ride.flight_number ?? ""}
                {ride.flight_airport ? ` · ${ride.flight_airport}` : ""}
                {ride.flight_terminal ? ` T${ride.flight_terminal}` : ""}
              </span>
            </SheetRow>
          ) : null}

          {vehicle ? (
            <SheetRow icon="car" label="Vehicle">
              <span className="tnum">
                {vehicle.display_name}
                {vehicle.plate ? ` · plate ${vehicle.plate}` : ""}
              </span>
            </SheetRow>
          ) : null}

          {ride.notes ? (
            <SheetRow icon="info" label="Notes">
              <span style={{ whiteSpace: "pre-wrap" }}>{ride.notes}</span>
            </SheetRow>
          ) : null}
        </div>

        <div
          className="px-5 py-4 space-y-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {next ? (
            <button
              onClick={() => onStatus(next)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-[10px] h-12 text-[15px] font-semibold"
              style={{
                background: "var(--accent)",
                color: "#15161B",
                border: "1px solid var(--accent-strong)",
              }}
            >
              <Icon
                name={next === "completed" ? "check" : "arrow"}
                size={16}
              />
              {nextLabel}
            </button>
          ) : (
            <div
              className="rounded-[10px] px-3 py-3 text-center text-sm"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              <Icon
                name="check"
                size={18}
                className="text-accent inline-block"
              />
              <div className="mt-1" style={{ fontWeight: 600 }}>
                Ride {ride.status}
              </div>
            </div>
          )}
          {ride.status === "in_progress" ? (
            <button
              onClick={() => onStatus("scheduled")}
              className="w-full inline-flex items-center justify-center h-10 rounded-[10px] text-[13px]"
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            >
              Revert to scheduled
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SheetRow({
  icon,
  label,
  children,
}: {
  icon: IconName;
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
        <div style={{ fontSize: 14, marginTop: 2 }}>{children}</div>
      </div>
    </div>
  );
}

/* ── helpers ───────────────────────────────────────────────────── */
function firstName(s: string | null | undefined): string {
  if (!s) return "";
  return s.split(/\s+/)[0].replace(/[(),]/g, "");
}

function groupByBucket(rides: Ride[]) {
  const out: Record<Bucket, Ride[]> = {
    Morning: [],
    Afternoon: [],
    Evening: [],
  };
  rides
    .slice()
    .sort(
      (a, b) =>
        new Date(a.pickup_at).getTime() - new Date(b.pickup_at).getTime(),
    )
    .forEach((r) => out[bucketOf(r.pickup_at)].push(r));
  return out;
}
