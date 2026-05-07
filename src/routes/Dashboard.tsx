import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listDrivers,
  listEvents,
  listRides,
  listVehicles,
} from "../lib/api";
import { fmtTime, relTime } from "../lib/format";
import { useAuth } from "../lib/auth";
import { Button } from "../components/Button";
import { Icon, type IconName } from "../components/Icon";
import { KpiCard } from "../components/KpiCard";
import { RideCard } from "../components/RideCard";
import type {
  ActivityEvent,
  Driver,
  Ride,
  Vehicle,
} from "../lib/types";

type Bucket = "Morning" | "Afternoon" | "Evening";

function bucketOf(iso: string): Bucket {
  const h = new Date(iso).getHours();
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function Dashboard() {
  const { profile } = useAuth();
  const [today, setToday] = useState<Ride[] | null>(null);
  const [tomorrowFirst, setTomorrowFirst] = useState<Ride | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [todays, drvs, vcs, evs] = await Promise.all([
          listRides({
            from: startOfDay().toISOString(),
            to: endOfDay().toISOString(),
          }),
          listDrivers(),
          listVehicles(),
          listEvents(8),
        ]);
        const tomorrowStart = startOfDay(
          new Date(Date.now() + 24 * 60 * 60 * 1000),
        );
        const tomorrows = await listRides({
          from: tomorrowStart.toISOString(),
          to: endOfDay(tomorrowStart).toISOString(),
          limit: 1,
        });
        if (cancelled) return;
        setToday(todays);
        setDrivers(drvs);
        setVehicles(vcs);
        setEvents(evs);
        setTomorrowFirst(tomorrows[0] ?? null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const driversById = useMemo(
    () => new Map(drivers.map((d) => [d.id, d])),
    [drivers],
  );
  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles],
  );

  const kpis = useMemo(() => {
    const list = today ?? [];
    return {
      total: list.length,
      airport: list.filter((r) => r.flight_number).length,
      ground: list.filter((r) => !r.flight_number).length,
      inProgress: list.filter((r) => r.status === "in_progress"),
      revenueCents: list
        .filter((r) => r.status !== "cancelled")
        .reduce((s, r) => s + r.total_cents, 0),
    };
  }, [today]);

  const groups = useMemo(() => {
    const out: Record<Bucket, Ride[]> = {
      Morning: [],
      Afternoon: [],
      Evening: [],
    };
    (today ?? [])
      .slice()
      .sort(
        (a, b) =>
          new Date(a.pickup_at).getTime() - new Date(b.pickup_at).getTime(),
      )
      .forEach((r) => out[bucketOf(r.pickup_at)].push(r));
    return out;
  }, [today]);

  const greeting = greetingForNow();

  return (
    <div>
      <PageHeader
        firstName={firstName(profile?.full_name)}
        greeting={greeting}
        ridesCount={kpis.total}
        inProgress={kpis.inProgress.length}
      />

      {error ? (
        <div className="mt-4 surface rounded-[12px] p-4 text-danger text-sm">
          {error}
        </div>
      ) : null}

      <section className="mt-6 grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard
          label="Today's rides"
          value={today === null ? "—" : kpis.total}
          hint={
            today === null
              ? undefined
              : `${kpis.airport} airport · ${kpis.ground} ground`
          }
          icon="rides"
        />
        <KpiCard
          label="In progress"
          value={today === null ? "—" : kpis.inProgress.length}
          hint={
            kpis.inProgress[0]
              ? `${kpis.inProgress[0].passenger_name} · ${fmtTime(
                  kpis.inProgress[0].pickup_at,
                )}`
              : "Nothing live right now"
          }
          icon="dot"
          accent={kpis.inProgress.length > 0}
        />
        <KpiCard
          label="Today's revenue"
          value={
            today === null
              ? "—"
              : (kpis.revenueCents / 100).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })
          }
          prefix="$"
          hint={
            today === null
              ? undefined
              : `${
                  (today ?? []).filter((r) => r.status === "completed").length
                } completed`
          }
          icon="invoice"
        />
        <KpiCard
          label="Tomorrow's first"
          value={tomorrowFirst ? fmtTime(tomorrowFirst.pickup_at) : "—"}
          hint={tomorrowFirst?.passenger_name ?? "No bookings yet"}
          icon="plane"
        />
      </section>

      <section className="mt-7 grid gap-5 lg:gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          {today === null ? (
            <div className="surface rounded-[12px] p-6 text-muted text-sm">
              Loading today's rides…
            </div>
          ) : kpis.total === 0 ? (
            <EmptyToday />
          ) : (
            <div className="flex flex-col gap-7">
              <TimelineGroup
                label="Morning"
                icon="sun"
                count={groups.Morning.length}
              >
                {groups.Morning.map((r) => (
                  <RideCard
                    key={r.id}
                    ride={r}
                    driver={r.driver_id ? driversById.get(r.driver_id) : null}
                    vehicle={
                      r.vehicle_id ? vehiclesById.get(r.vehicle_id) : null
                    }
                  />
                ))}
              </TimelineGroup>
              <TimelineGroup
                label="Afternoon"
                icon="spark"
                count={groups.Afternoon.length}
              >
                {groups.Afternoon.map((r) => (
                  <RideCard
                    key={r.id}
                    ride={r}
                    driver={r.driver_id ? driversById.get(r.driver_id) : null}
                    vehicle={
                      r.vehicle_id ? vehiclesById.get(r.vehicle_id) : null
                    }
                  />
                ))}
              </TimelineGroup>
              <TimelineGroup
                label="Evening"
                icon="moon2"
                count={groups.Evening.length}
              >
                {groups.Evening.map((r) => (
                  <RideCard
                    key={r.id}
                    ride={r}
                    driver={r.driver_id ? driversById.get(r.driver_id) : null}
                    vehicle={
                      r.vehicle_id ? vehiclesById.get(r.vehicle_id) : null
                    }
                  />
                ))}
              </TimelineGroup>
            </div>
          )}
        </div>
        <div className="order-first lg:order-none">
          <HeartbeatPanel
            tomorrowFirst={tomorrowFirst}
            inProgressCount={kpis.inProgress.length}
            todayCount={kpis.total}
          />
        </div>
      </section>

      <section className="mt-8">
        <ActivityFeed items={events} />
      </section>

      <footer
        className="mt-10 mb-2 text-muted flex items-center justify-between"
        style={{ fontSize: 11.5 }}
      >
        <span>SDLuxury Transportation, Inc. · Internal</span>
        <span className="tnum">v0.2 · Today</span>
      </footer>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

function PageHeader({
  firstName,
  greeting,
  ridesCount,
  inProgress,
}: {
  firstName: string;
  greeting: string;
  ridesCount: number;
  inProgress: number;
}) {
  const dateLong = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  let summary: string;
  if (ridesCount === 0)
    summary = "No rides on the schedule yet.";
  else
    summary = `${ridesCount} ride${ridesCount === 1 ? "" : "s"} on the schedule.${
      inProgress ? ` ${inProgress} in progress.` : ""
    }`;

  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 md:gap-4">
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
          {dateLong}
        </div>
        <h1
          className="mt-1"
          style={{
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          {greeting}, {firstName}.
        </h1>
        <p
          className="text-muted mt-1"
          style={{ fontSize: 14, lineHeight: 1.5 }}
        >
          {summary}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link to="/rides">
          <Button variant="quiet" icon="calendar">
            View week
          </Button>
        </Link>
        <Link to="/rides/new">
          <Button variant="primary" icon="plus">
            Add ride
          </Button>
        </Link>
      </div>
    </div>
  );
}

function TimelineGroup({
  label,
  count,
  icon,
  children,
}: {
  label: string;
  count: number;
  icon: IconName;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="relative">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Icon name={icon} size={14} className="text-muted" />
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {label}
          </h3>
        </div>
        <span className="text-muted tnum" style={{ fontSize: 12 }}>
          {count} {count === 1 ? "ride" : "rides"}
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: "var(--border)" }}
        />
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function HeartbeatPanel({
  tomorrowFirst,
  inProgressCount,
  todayCount,
}: {
  tomorrowFirst: Ride | null;
  inProgressCount: number;
  todayCount: number;
}) {
  const message =
    inProgressCount > 0
      ? `${inProgressCount} ride${
          inProgressCount === 1 ? " is" : "s are"
        } currently in progress. I'll flag flight changes and re-confirm pickups as needed.`
      : todayCount > 0
        ? "All rides are scheduled. Watching flight changes and traffic windows in the background."
        : "Nothing on the schedule yet today. Add a ride or have your Claude agent create one.";

  return (
    <aside
      className="surface rounded-[12px] overflow-hidden flex flex-col"
      style={{ boxShadow: "var(--shadow-md)" }}
    >
      <header
        className="flex items-center justify-between px-5 py-4"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="pulse-dot"
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "var(--success)",
            }}
          />
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              Heartbeat
            </div>
            <div className="text-muted" style={{ fontSize: 11.5 }}>
              Operations agent · live
            </div>
          </div>
        </div>
        <div className="text-muted tnum" style={{ fontSize: 11.5 }}>
          {new Date().toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          })}
        </div>
      </header>

      <div className="px-5 py-4">
        <div
          className="text-muted"
          style={{
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Latest update
        </div>
        <p
          className="mt-2"
          style={{
            fontSize: 14.5,
            lineHeight: 1.55,
            letterSpacing: "-0.005em",
          }}
        >
          {message}
        </p>
        {tomorrowFirst ? (
          <p
            className="mt-2 text-muted"
            style={{ fontSize: 13, lineHeight: 1.55 }}
          >
            Tomorrow opens with{" "}
            <span style={{ color: "var(--accent)" }}>
              {tomorrowFirst.passenger_name}
            </span>{" "}
            at{" "}
            <span className="tnum">
              {fmtTime(tomorrowFirst.pickup_at)}
            </span>
            .
          </p>
        ) : null}
      </div>

      <div className="px-5 pb-5">
        <div
          className="text-muted mb-2"
          style={{
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Quick actions
        </div>
        <div className="flex flex-col gap-2">
          <QuickAction
            to="/rides/new"
            icon="plus"
            label="Add ride"
            hint="New booking · pickup, drop, driver"
          />
          <QuickAction
            to="/rides"
            icon="doc"
            label="View rides"
            hint="All upcoming and past rides"
          />
          <QuickAction
            to="/settings"
            icon="settings"
            label="Settings"
            hint="Connectors, team, branding"
          />
        </div>
      </div>
    </aside>
  );
}

function QuickAction({
  to,
  icon,
  label,
  hint,
}: {
  to: string;
  icon: IconName;
  label: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="w-full flex items-center gap-3 text-left rounded-[10px] px-3 py-2.5 transition"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        className="inline-grid place-items-center"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          color: "var(--accent)",
        }}
      >
        <Icon name={icon} size={15} />
      </span>
      <span className="flex-1 min-w-0">
        <span
          className="block"
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            letterSpacing: "-0.005em",
          }}
        >
          {label}
        </span>
        <span
          className="block text-muted truncate"
          style={{ fontSize: 11.5 }}
        >
          {hint}
        </span>
      </span>
      <Icon name="chev" size={14} className="text-muted" />
    </Link>
  );
}

const KIND_META: Record<string, { icon: IconName; color: string }> = {
  system: { icon: "spark", color: "var(--accent)" },
  user: { icon: "user", color: "var(--text-muted)" },
  driver: { icon: "drivers", color: "var(--text-muted)" },
  mcp: { icon: "spark", color: "var(--accent)" },
};

function ActivityFeed({ items }: { items: ActivityEvent[] }) {
  return (
    <section className="surface rounded-[12px] overflow-hidden">
      <header
        className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <h3
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Recent activity
        </h3>
        <span className="text-muted" style={{ fontSize: 12.5 }}>
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </header>
      {items.length === 0 ? (
        <div className="px-5 py-6 text-muted text-sm">No activity yet.</div>
      ) : (
        <ul>
          {items.map((it, i) => {
            const m = KIND_META[it.source] ?? KIND_META.system;
            return (
              <li
                key={it.id}
                className="flex items-start gap-3 px-5 py-3"
                style={{
                  borderTop: i === 0 ? "none" : "1px solid var(--border)",
                }}
              >
                <span
                  className="inline-grid place-items-center mt-0.5"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: m.color,
                  }}
                >
                  <Icon name={m.icon} size={13} />
                </span>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>
                    <span style={{ fontWeight: 600 }}>{it.source}</span>
                    <span className="text-muted"> · {it.message}</span>
                  </div>
                  <div
                    className="text-muted tnum mt-0.5"
                    style={{ fontSize: 11.5 }}
                  >
                    {relTime(it.created_at)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function EmptyToday() {
  return (
    <div className="surface rounded-[12px] p-8 text-center">
      <div
        className="inline-grid place-items-center mb-3"
        style={{
          width: 48,
          height: 48,
          borderRadius: 999,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--accent)",
        }}
      >
        <Icon name="calendar" size={20} />
      </div>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        Nothing on the schedule today
      </h3>
      <p
        className="text-muted mx-auto mt-1"
        style={{ fontSize: 13, maxWidth: 340 }}
      >
        Add a ride manually or have your Claude agent create one — it'll appear
        here in real time.
      </p>
      <div className="mt-4 inline-flex gap-2">
        <Link to="/rides/new">
          <Button variant="primary" icon="plus">
            Add ride
          </Button>
        </Link>
      </div>
    </div>
  );
}

function firstName(full: string | null | undefined): string {
  if (!full) return "there";
  return full.trim().split(/\s+/)[0] ?? "there";
}

function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
