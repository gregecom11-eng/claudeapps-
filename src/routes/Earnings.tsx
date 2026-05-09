// Earnings — owner's revenue dashboard.
//
// One page, one timeline, one truth: earned vs projected. The period
// switcher drives every panel below it. Realtime listens to ride
// changes — adding, cancelling, or marking a ride completed updates
// every number and chart in place, no refresh needed.
//
// Earned   = sum(total_cents) for completed, non-cancelled rides in window
// Projected = sum(total_cents) for non-cancelled rides in window
// Remaining = Projected − Earned

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listClients,
  listAllDrivers,
  listRides,
} from "../lib/api";
import { BUSINESS_TZ, fmtMoney } from "../lib/format";
import { useRideRealtime } from "../lib/realtime";
import { KpiCard } from "../components/KpiCard";
import {
  CumulativeRevenueChart,
  DailyRevenueBars,
  type RevenuePoint,
} from "../components/RevenueCharts";
import type { Client, Driver, Ride } from "../lib/types";

type PeriodId = "today" | "week" | "month" | "quarter" | "year";

type Period = {
  id: PeriodId;
  label: string;
  from: Date;
  to: Date;
};

// ── Period boundaries, anchored to the business timezone ─────────
//
// We need start/end of each period as actual UTC instants so they line
// up with rides.pickup_at. Trick: render "now" in LA to get its
// civil parts (Y/M/D/H/M), then construct UTC instants by combining
// those civil parts with the LA UTC offset for that day.

function laOffsetFor(d: Date): string {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    timeZoneName: "longOffset",
  })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value;
  return part?.replace("GMT", "") || "+00:00";
}

function laCivil(d: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [y, m, dd] = parts.split("-").map((s) => parseInt(s, 10));
  return { year: y, month: m, day: dd };
}

function laInstant(year: number, month: number, day: number, end = false): Date {
  // Construct a Date for midnight (or 23:59:59.999) on that LA civil day.
  const probe = new Date(
    `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}T12:00:00Z`,
  );
  const offset = laOffsetFor(probe);
  const time = end ? "23:59:59.999" : "00:00:00.000";
  return new Date(
    `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}T${time}${offset}`,
  );
}

function pad(n: number, w: number): string {
  return String(n).padStart(w, "0");
}

function periodFor(id: PeriodId, now = new Date()): Period {
  const c = laCivil(now);
  const startToday = laInstant(c.year, c.month, c.day, false);
  const endToday = laInstant(c.year, c.month, c.day, true);

  if (id === "today") {
    return { id, label: "Today", from: startToday, to: endToday };
  }

  if (id === "week") {
    // Week = Mon–Sun, anchored in LA.
    const weekdayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const wkName = new Intl.DateTimeFormat("en-US", {
      timeZone: BUSINESS_TZ,
      weekday: "short",
    }).format(now);
    const laDow = weekdayMap[wkName] ?? 0;
    const daysSinceMon = (laDow + 6) % 7; // Mon=0
    const monStart = addDays(startToday, -daysSinceMon);
    const sunCivil = laCivil(addDays(monStart, 6));
    return {
      id,
      label: "This week",
      from: monStart,
      to: laInstant(sunCivil.year, sunCivil.month, sunCivil.day, true),
    };
  }

  if (id === "month") {
    const start = laInstant(c.year, c.month, 1);
    const lastDay = daysInMonth(c.year, c.month);
    const end = laInstant(c.year, c.month, lastDay, true);
    return { id, label: "This month", from: start, to: end };
  }

  if (id === "quarter") {
    const qStartMonth = Math.floor((c.month - 1) / 3) * 3 + 1;
    const start = laInstant(c.year, qStartMonth, 1);
    const qEndMonth = qStartMonth + 2;
    const lastDay = daysInMonth(c.year, qEndMonth);
    const end = laInstant(c.year, qEndMonth, lastDay, true);
    return { id, label: "This quarter", from: start, to: end };
  }

  // year
  const start = laInstant(c.year, 1, 1);
  const end = laInstant(c.year, 12, 31, true);
  return { id, label: c.year.toString(), from: start, to: end };
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400_000);
}

// LA-day key for any UTC instant. Used to bucket rides into days.
function laDayKey(iso: string): string {
  const c = laCivil(new Date(iso));
  return `${pad(c.year, 4)}-${pad(c.month, 2)}-${pad(c.day, 2)}`;
}

function dayKeyOfDate(d: Date): string {
  const c = laCivil(d);
  return `${pad(c.year, 4)}-${pad(c.month, 2)}-${pad(c.day, 2)}`;
}

function fmtDollars(cents: number): string {
  return Math.round(cents / 100).toLocaleString();
}

function eachDay(from: Date, to: Date): string[] {
  const out: string[] = [];
  const startCivil = laCivil(from);
  let cur = laInstant(startCivil.year, startCivil.month, startCivil.day);
  while (cur.getTime() <= to.getTime()) {
    out.push(dayKeyOfDate(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

// ── The page ──────────────────────────────────────────────────────
export function Earnings() {
  const [periodId, setPeriodId] = useState<PeriodId>("month");
  const period = useMemo(() => periodFor(periodId), [periodId]);

  const [rides, setRides] = useState<Ride[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);

  const load = useCallback(async () => {
    try {
      const [rs, cs, ds] = await Promise.all([
        listRides({
          from: period.from.toISOString(),
          to: period.to.toISOString(),
          limit: 1000,
        }),
        listClients(),
        listAllDrivers(),
      ]);
      setRides(rs);
      setClients(cs);
      setDrivers(ds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [period.from, period.to]);

  useEffect(() => {
    load();
  }, [load]);

  useRideRealtime(() => {
    setPulse((p) => p + 1);
    load();
  });

  const series = useMemo<RevenuePoint[]>(() => {
    const days = eachDay(period.from, period.to);
    const map = new Map<string, { earned: number; projected: number }>();
    for (const d of days) map.set(d, { earned: 0, projected: 0 });
    for (const r of rides ?? []) {
      if (r.status === "cancelled") continue;
      const k = laDayKey(r.pickup_at);
      const slot = map.get(k);
      if (!slot) continue;
      if (r.status === "completed") slot.earned += r.total_cents;
      else slot.projected += r.total_cents;
    }
    return days.map((d) => ({
      day: d,
      earnedCents: map.get(d)!.earned,
      projectedCents: map.get(d)!.projected,
    }));
  }, [rides, period.from, period.to]);

  const totals = useMemo(() => {
    let earned = 0;
    let projected = 0; // includes earned
    let completedCount = 0;
    let bookedCount = 0;
    for (const r of rides ?? []) {
      if (r.status === "cancelled") continue;
      bookedCount++;
      projected += r.total_cents;
      if (r.status === "completed") {
        earned += r.total_cents;
        completedCount++;
      }
    }
    return {
      earned,
      projected,
      remaining: Math.max(0, projected - earned),
      completedCount,
      bookedCount,
      avgCompleted: completedCount > 0 ? earned / completedCount : 0,
    };
  }, [rides]);

  const todayIndex = useMemo(() => {
    const today = dayKeyOfDate(new Date());
    const idx = series.findIndex((p) => p.day === today);
    if (idx >= 0) return idx;
    // If "today" is past the window, treat the whole window as earned.
    if (series.length > 0 && today > series[series.length - 1].day) {
      return series.length - 1;
    }
    // If "today" is before the window starts, nothing's earned.
    return -1;
  }, [series]);

  const topClients = useMemo(
    () =>
      topByGroup(
        rides ?? [],
        (r) => r.client_id,
        (id) => clients.find((c) => c.id === id)?.name ?? "Unknown client",
      ),
    [rides, clients],
  );
  const topDrivers = useMemo(
    () =>
      topByGroup(
        rides ?? [],
        (r) => r.driver_id,
        (id) => drivers.find((d) => d.id === id)?.full_name ?? "Unknown driver",
      ),
    [rides, drivers],
  );

  return (
    <div>
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div
            className="text-muted"
            style={{
              fontSize: 12.5,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Earnings
          </div>
          <h1
            className="mt-1 flex items-center gap-2.5"
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            {period.label}
            <span
              key={pulse}
              title="Live — updates as rides change"
              aria-label="Live"
              className="inline-block"
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "var(--success)",
                animation: "pulse-dot 1.6s ease-out",
              }}
            />
          </h1>
          <p
            className="text-muted mt-1"
            style={{ fontSize: 13.5, lineHeight: 1.5 }}
          >
            Earned, projected, and what's still on the books — live, in
            Los Angeles time.
          </p>
        </div>
        <PeriodSwitcher value={periodId} onChange={setPeriodId} />
      </header>

      {error ? (
        <div className="mt-4 surface rounded-[12px] p-4 text-danger text-sm">
          {error}
        </div>
      ) : null}

      <section className="mt-6 grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard
          label="Earned"
          value={rides === null ? "—" : fmtDollars(totals.earned)}
          prefix="$"
          hint={
            rides === null
              ? undefined
              : `${totals.completedCount} ride${
                  totals.completedCount === 1 ? "" : "s"
                } completed`
          }
          icon="check"
        />
        <KpiCard
          label="Projected"
          value={rides === null ? "—" : fmtDollars(totals.projected)}
          prefix="$"
          hint={
            rides === null
              ? undefined
              : `${totals.bookedCount} ride${
                  totals.bookedCount === 1 ? "" : "s"
                } on the books`
          }
          icon="spark"
          accent
        />
        <KpiCard
          label="Remaining"
          value={rides === null ? "—" : fmtDollars(totals.remaining)}
          prefix="$"
          hint={
            rides === null
              ? undefined
              : `${totals.bookedCount - totals.completedCount} not yet completed`
          }
          icon="clock"
        />
        <KpiCard
          label="Avg / completed ride"
          value={rides === null ? "—" : fmtDollars(totals.avgCompleted)}
          prefix="$"
          hint={
            totals.completedCount === 0
              ? "No completed rides yet in this window"
              : undefined
          }
          icon="wallet"
        />
      </section>

      <section className="mt-6 surface rounded-[12px] p-4 md:p-5">
        <div
          className="flex items-end justify-between gap-3 mb-2"
          style={{ minHeight: 24 }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>
            Cumulative revenue
          </h2>
          <div className="text-muted tnum" style={{ fontSize: 12 }}>
            Window total:{" "}
            <span style={{ color: "var(--text)", fontWeight: 600 }}>
              {fmtMoney(totals.projected)}
            </span>
          </div>
        </div>
        {series.length === 0 ? (
          <ChartEmpty />
        ) : (
          <CumulativeRevenueChart data={series} todayIndex={todayIndex} />
        )}
      </section>

      <section className="mt-4 surface rounded-[12px] p-4 md:p-5">
        <h2 style={{ fontSize: 15, fontWeight: 600 }} className="mb-2">
          Revenue by day
        </h2>
        {series.length === 0 ? (
          <ChartEmpty />
        ) : (
          <DailyRevenueBars data={series} />
        )}
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <TopList
          title="Top clients"
          subtitle="Booked revenue this window — completed and on-the-books."
          rows={topClients}
        />
        <TopList
          title="Top drivers"
          subtitle="Earned revenue (completed only) — useful for tip-outs."
          rows={topDrivers}
          completedOnly
        />
      </section>

      <style>{`
        @keyframes pulse-dot {
          0%   { transform: scale(1);   opacity: 1; }
          70%  { transform: scale(2.5); opacity: 0; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Period switcher ───────────────────────────────────────────────
function PeriodSwitcher({
  value,
  onChange,
}: {
  value: PeriodId;
  onChange: (v: PeriodId) => void;
}) {
  const items: { id: PeriodId; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
    { id: "quarter", label: "Quarter" },
    { id: "year", label: "Year" },
  ];
  return (
    <div
      className="surface rounded-[10px] p-1 flex"
      style={{ background: "var(--surface-2)" }}
    >
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            className="inline-flex items-center justify-center h-8 px-3 rounded-[7px] text-[13px] font-medium transition"
            style={{
              background: active ? "var(--surface)" : "transparent",
              color: active ? "var(--text)" : "var(--text-muted)",
              border: active ? "1px solid var(--border)" : "1px solid transparent",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Top-N panels ──────────────────────────────────────────────────
type TopRow = {
  id: string;
  label: string;
  earnedCents: number;
  projectedCents: number;
  rideCount: number;
};

function topByGroup(
  rides: Ride[],
  pickId: (r: Ride) => string | null,
  resolveLabel: (id: string) => string,
): TopRow[] {
  const map = new Map<string, TopRow>();
  for (const r of rides) {
    if (r.status === "cancelled") continue;
    const id = pickId(r);
    if (!id) continue;
    const slot: TopRow =
      map.get(id) ?? {
        id,
        label: resolveLabel(id),
        earnedCents: 0,
        projectedCents: 0,
        rideCount: 0,
      };
    slot.rideCount++;
    slot.projectedCents += r.total_cents;
    if (r.status === "completed") slot.earnedCents += r.total_cents;
    map.set(id, slot);
  }
  return Array.from(map.values())
    .sort((a, b) => b.projectedCents - a.projectedCents)
    .slice(0, 5);
}

function TopList({
  title,
  subtitle,
  rows,
  completedOnly,
}: {
  title: string;
  subtitle: string;
  rows: TopRow[];
  completedOnly?: boolean;
}) {
  const max =
    rows.length === 0
      ? 0
      : Math.max(
          ...rows.map((r) =>
            completedOnly ? r.earnedCents : r.projectedCents,
          ),
        );
  return (
    <div className="surface rounded-[12px]">
      <div
        className="px-4 pt-4 pb-2"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>{title}</h2>
        <p
          className="text-muted mt-1"
          style={{ fontSize: 12.5, lineHeight: 1.5 }}
        >
          {subtitle}
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="p-5 text-muted text-sm">No data in this window.</div>
      ) : (
        <ul>
          {rows.map((r, i) => {
            const value = completedOnly ? r.earnedCents : r.projectedCents;
            const pct = max > 0 ? (value / max) * 100 : 0;
            return (
              <li
                key={r.id}
                className="px-4 py-3"
                style={{
                  borderTop: i === 0 ? "none" : "1px solid var(--border)",
                }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div
                    className="truncate"
                    style={{ fontSize: 13.5, fontWeight: 600 }}
                  >
                    {r.label}
                  </div>
                  <div
                    className="tnum"
                    style={{ fontSize: 13.5, fontWeight: 600 }}
                  >
                    {fmtMoney(value)}
                  </div>
                </div>
                <div
                  className="mt-1.5 rounded-full overflow-hidden"
                  style={{
                    height: 4,
                    background: "var(--surface-2)",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: completedOnly
                        ? "var(--success)"
                        : "var(--accent)",
                    }}
                  />
                </div>
                <div
                  className="text-muted mt-1 tnum"
                  style={{ fontSize: 11.5 }}
                >
                  {r.rideCount} ride{r.rideCount === 1 ? "" : "s"}
                  {!completedOnly && r.earnedCents !== r.projectedCents
                    ? ` · ${fmtMoney(r.earnedCents)} already earned`
                    : ""}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ChartEmpty() {
  return (
    <div
      className="rounded-[10px] p-6 text-center"
      style={{
        background: "var(--surface-2)",
        border: "1px dashed var(--border)",
      }}
    >
      <p className="text-muted" style={{ fontSize: 13.5 }}>
        Nothing on the books in this window yet.{" "}
        <Link to="/rides/new" className="text-accent">
          Add a ride
        </Link>{" "}
        to see it light up.
      </p>
    </div>
  );
}
