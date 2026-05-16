// Earnings — owner's revenue, profit, and decision-support view.
//
// Redesigned per dispatch-101/Earnings.html. Top: period chips with a
// compare-to dropdown. Below: 4 KPI cards (My income, Fleet revenue,
// Remaining, Avg/ride), one big chart, then a grid of insights, service
// mix, AR aging, top clients, scenario knobs, driver payouts, and
// vehicle profitability.
//
// Two perspectives are kept distinct everywhere:
//   - My income     = what the owner-operator personally takes home
//                     (their driven rides full-fare + commission share
//                      on rides driven by others)
//   - Fleet revenue = total collected, regardless of who drove
//
// Week defaults Mon → Sun. All windows anchored to America/Los_Angeles.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listAllDrivers,
  listClients,
  listFixedExpenses,
  listInvoices,
  listMaintenance,
  listRideCostsForRides,
  listRides,
  listVehicles,
} from "../lib/api";
import { fmtMoney } from "../lib/format";
import { useRideRealtime } from "../lib/realtime";
import {
  buildOwnerLens,
  fleetEarnedCents,
  fleetProjectedCents,
  inferTripType,
  myEarnedCents,
  myProjectedCents,
  type TripType,
} from "../lib/earnings";
import {
  fixedExpenseAllocatedCents,
  fixedExpenseAllocatedCentsByVehicle,
  maintenanceAllocatedCents,
  maintenanceAllocatedCentsByVehicle,
} from "../lib/expenses";
import type {
  Client,
  Driver,
  ExpenseFixed,
  Invoice,
  Ride,
  RideCost,
  Vehicle,
  VehicleMaintenance,
} from "../lib/types";

import {
  EarningsDateControls,
  EarningsKpi,
  type CompareMode,
} from "../components/earnings/atoms";
import {
  eachDay,
  laDayKey,
  periodFor,
  type Period,
  type PeriodId,
} from "../components/earnings/period";
import { EarningsRevenueChart } from "../components/earnings/RevenueChart";
import { EarningsServiceMix } from "../components/earnings/ServiceMix";
import {
  EarningsTopClients,
  type TopClientRow,
} from "../components/earnings/TopClients";
import { EarningsARAging } from "../components/earnings/ARAging";
import {
  EarningsInsights,
  buildInsights,
} from "../components/earnings/Insights";
import {
  EarningsDriverPayouts,
  type DriverPayoutRow,
} from "../components/earnings/DriverPayouts";
import { EarningsForecast } from "../components/earnings/Forecast";
import {
  EarningsVehicleProf,
  type VehicleProfRow,
} from "../components/earnings/VehicleProf";

// ── Aggregation helpers ───────────────────────────────────────────

type WindowTotals = {
  myEarned: number;
  myProjected: number;
  fleetEarned: number;
  fleetProjected: number;
  completedCount: number;
  bookedCount: number;
  avgCompletedCents: number;
};

function aggregateWindow(
  rides: Ride[],
  lens: ReturnType<typeof buildOwnerLens>,
): WindowTotals {
  let myEarned = 0,
    myProjected = 0,
    fleetEarned = 0,
    fleetProjected = 0,
    completedCount = 0,
    bookedCount = 0,
    myCompletedAcc = 0,
    myCompletedCount = 0;
  for (const r of rides) {
    if (r.status === "cancelled") continue;
    bookedCount++;
    fleetProjected += fleetProjectedCents(r);
    myProjected += myProjectedCents(r, lens);
    if (r.status === "completed") {
      completedCount++;
      fleetEarned += fleetEarnedCents(r);
      const mine = myEarnedCents(r, lens);
      myEarned += mine;
      if (mine > 0) {
        myCompletedAcc += mine;
        myCompletedCount++;
      }
    }
  }
  return {
    myEarned,
    myProjected,
    fleetEarned,
    fleetProjected,
    completedCount,
    bookedCount,
    avgCompletedCents:
      myCompletedCount > 0 ? myCompletedAcc / myCompletedCount : 0,
  };
}

function dailySeries(
  rides: Ride[],
  lens: ReturnType<typeof buildOwnerLens>,
  period: Period,
): { day: string; cents: number }[] {
  const days = eachDay(period.from, period.to);
  const map = new Map<string, number>();
  for (const d of days) map.set(d, 0);
  for (const r of rides) {
    if (r.status === "cancelled") continue;
    const k = laDayKey(r.pickup_at);
    if (!map.has(k)) continue;
    const cents =
      r.status === "completed"
        ? myEarnedCents(r, lens)
        : myProjectedCents(r, lens);
    map.set(k, (map.get(k) ?? 0) + cents);
  }
  return days.map((d) => ({ day: d, cents: map.get(d) ?? 0 }));
}

function dailySeriesByCalendarDays(
  rides: Ride[],
  lens: ReturnType<typeof buildOwnerLens>,
  from: Date,
  to: Date,
): { day: string; cents: number }[] {
  const days = eachDay(from, to);
  const map = new Map<string, number>();
  for (const d of days) map.set(d, 0);
  for (const r of rides) {
    if (r.status === "cancelled") continue;
    const k = laDayKey(r.pickup_at);
    if (!map.has(k)) continue;
    const cents =
      r.status === "completed"
        ? myEarnedCents(r, lens)
        : myProjectedCents(r, lens);
    map.set(k, (map.get(k) ?? 0) + cents);
  }
  return days.map((d) => ({ day: d, cents: map.get(d) ?? 0 }));
}

function buildTopClients(
  rides: Ride[],
  clients: Client[],
): TopClientRow[] {
  const byClient = new Map<string, TopClientRow>();
  for (const r of rides) {
    if (r.status === "cancelled") continue;
    const id = r.client_id ?? `walkin:${r.passenger_name}`;
    const slot = byClient.get(id) ?? {
      id,
      name: r.client_id
        ? clients.find((c) => c.id === r.client_id)?.name ?? "Unknown client"
        : r.passenger_name || "Walk-in",
      bookedCents: 0,
      earnedCents: 0,
      rideCount: 0,
    };
    slot.bookedCents += r.total_cents;
    slot.rideCount++;
    if (r.status === "completed") slot.earnedCents += r.total_cents;
    byClient.set(id, slot);
  }
  return Array.from(byClient.values())
    .sort((a, b) => b.bookedCents - a.bookedCents)
    .slice(0, 8);
}

function buildServiceMix(rides: Ride[]): Record<TripType, number> {
  const out: Record<TripType, number> = {
    airport: 0,
    p2p: 0,
    hourly: 0,
    other: 0,
  };
  for (const r of rides) {
    if (r.status === "cancelled") continue;
    out[inferTripType(r)] += r.total_cents;
  }
  return out;
}

function buildDriverPayouts(
  rides: Ride[],
  drivers: Driver[],
  lens: ReturnType<typeof buildOwnerLens>,
): DriverPayoutRow[] {
  const byDriver = new Map<string, DriverPayoutRow>();
  for (const r of rides) {
    if (r.status !== "completed") continue;
    if (!r.driver_id) continue;
    const d = drivers.find((dr) => dr.id === r.driver_id);
    const slot = byDriver.get(r.driver_id) ?? {
      id: r.driver_id,
      name: d?.full_name ?? "Unknown driver",
      isOwner: d?.is_owner === true,
      commissionBps:
        typeof d?.commission_rate_bps === "number"
          ? d.commission_rate_bps
          : 0,
      rideCount: 0,
      grossCents: 0,
      ownerShareCents: 0,
    };
    slot.rideCount++;
    slot.grossCents += r.total_cents;
    slot.ownerShareCents += myEarnedCents(r, lens);
    byDriver.set(r.driver_id, slot);
  }
  return Array.from(byDriver.values()).sort(
    (a, b) => b.grossCents - a.grossCents,
  );
}

function buildVehicleProf(
  rides: Ride[],
  vehicles: Vehicle[],
  rideCosts: RideCost[],
  fuelByVehicle: Map<string, number>,
  maintenanceByVehicle: Map<string, number>,
  fixedByVehicle: Map<string, number>,
  windowDays: number,
): VehicleProfRow[] {
  void rideCosts; // included so the signature documents its intent
  const byVehicle = new Map<
    string,
    VehicleProfRow & { _days: Set<string> }
  >();
  for (const r of rides) {
    if (r.status === "cancelled") continue;
    if (!r.vehicle_id) continue;
    const v = vehicles.find((vh) => vh.id === r.vehicle_id);
    const slot = byVehicle.get(r.vehicle_id) ?? {
      id: r.vehicle_id,
      name: v?.display_name ?? "Unknown vehicle",
      plate: v?.plate ?? null,
      rideCount: 0,
      revenueCents: 0,
      fuelCents: 0,
      maintenanceCents: 0,
      fixedCents: 0,
      utilization: 0,
      _days: new Set<string>(),
    };
    slot.rideCount++;
    slot.revenueCents += r.total_cents;
    slot._days.add(laDayKey(r.pickup_at));
    byVehicle.set(r.vehicle_id, slot);
  }
  return Array.from(byVehicle.values())
    .map((s) => ({
      id: s.id,
      name: s.name,
      plate: s.plate,
      rideCount: s.rideCount,
      revenueCents: s.revenueCents,
      fuelCents: fuelByVehicle.get(s.id) ?? 0,
      maintenanceCents: maintenanceByVehicle.get(s.id) ?? 0,
      fixedCents: fixedByVehicle.get(s.id) ?? 0,
      utilization: Math.min(
        1,
        windowDays > 0 ? s._days.size / windowDays : 0,
      ),
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents);
}

// Sum gas-category ride costs per vehicle for rides in the window.
// Uses actual when confirmed, else falls back to estimate.
function buildFuelByVehicle(
  rides: Ride[],
  rideCosts: RideCost[],
): Map<string, number> {
  const rideToVehicle = new Map<string, string>();
  for (const r of rides) {
    if (r.vehicle_id) rideToVehicle.set(r.id, r.vehicle_id);
  }
  const out = new Map<string, number>();
  for (const c of rideCosts) {
    if (c.category !== "gas") continue;
    const vid = rideToVehicle.get(c.ride_id);
    if (!vid) continue;
    const cents = c.actual_cents ?? c.estimated_cents;
    out.set(vid, (out.get(vid) ?? 0) + cents);
  }
  return out;
}

// ── Header bar ────────────────────────────────────────────────────

function EarningsPageHeader({ period }: { period: Period }) {
  return (
    <div
      className="flex items-end justify-between gap-6 pb-7 mb-7 flex-wrap"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="min-w-0">
        <p className="eyebrow mb-3" style={{ letterSpacing: "0.22em" }}>
          Earnings · {period.label}
        </p>
        <h1
          className="serif"
          style={{
            fontSize: 44,
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
            fontWeight: 500,
          }}
        >
          The{" "}
          <span style={{ fontStyle: "italic", color: "var(--accent)" }}>
            numbers
          </span>
          , told plainly.
        </h1>
        <p
          className="text-muted mt-3"
          style={{ fontSize: 14.5, maxWidth: 560, lineHeight: 1.55 }}
        >
          Your income, the fleet's revenue, what's still on the books, and a
          quiet running tally of what's working — so you can decide what to
          do next.
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export function Earnings() {
  const [periodId, setPeriodId] = useState<PeriodId>("week");
  const [compareMode, setCompareMode] = useState<CompareMode>("prev");
  const period = useMemo(() => periodFor(periodId), [periodId]);

  const [rides, setRides] = useState<Ride[] | null>(null);
  const [prevRides, setPrevRides] = useState<Ride[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<ExpenseFixed[]>([]);
  const [maintenance, setMaintenance] = useState<VehicleMaintenance[]>([]);
  const [rideCosts, setRideCosts] = useState<RideCost[]>([]);
  const [prevRideCosts, setPrevRideCosts] = useState<RideCost[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Resolve the comparison window from the compareMode + period.
  const compareWindow = useMemo(() => {
    if (compareMode === "none") return null;
    if (compareMode === "yoy") {
      return { from: period.yoyFrom, to: period.yoyTo };
    }
    return { from: period.prevFrom, to: period.prevTo };
  }, [compareMode, period]);

  const load = useCallback(async () => {
    try {
      const [rs, prs, cs, ds, vs, invs, fx, mt] = await Promise.all([
        listRides({
          from: period.from.toISOString(),
          to: period.to.toISOString(),
          limit: 1000,
        }),
        compareWindow
          ? listRides({
              from: compareWindow.from.toISOString(),
              to: compareWindow.to.toISOString(),
              limit: 1000,
            })
          : Promise.resolve([]),
        listClients(),
        listAllDrivers(),
        listVehicles(),
        listInvoices().catch(() => []),
        listFixedExpenses().catch(() => []),
        listMaintenance().catch(() => []),
      ]);
      setRides(rs);
      setPrevRides(compareWindow ? prs : null);
      setClients(cs);
      setDrivers(ds);
      setVehicles(vs);
      setInvoices(invs);
      setFixedExpenses(fx);
      setMaintenance(mt);
      // Per-ride costs for both windows. Issued as separate queries so a
      // missing migration on either side doesn't blank the whole page.
      const rcCurr =
        rs.length > 0
          ? await listRideCostsForRides(rs.map((r) => r.id)).catch(() => [])
          : [];
      setRideCosts(rcCurr);
      const rcPrev =
        compareWindow && prs.length > 0
          ? await listRideCostsForRides(prs.map((r) => r.id)).catch(() => [])
          : [];
      setPrevRideCosts(rcPrev);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [period.from, period.to, compareWindow]);

  useEffect(() => {
    load();
  }, [load]);

  useRideRealtime(() => {
    load();
  });

  const lens = useMemo(() => buildOwnerLens(drivers), [drivers]);

  const totals = useMemo(
    () =>
      rides ? aggregateWindow(rides, lens) : null,
    [rides, lens],
  );
  const prevTotals = useMemo(
    () => (prevRides ? aggregateWindow(prevRides, lens) : null),
    [prevRides, lens],
  );

  const series = useMemo(
    () => (rides ? dailySeries(rides, lens, period) : []),
    [rides, lens, period],
  );
  const prevSeries = useMemo(() => {
    if (!prevRides || !compareWindow) return null;
    return dailySeriesByCalendarDays(
      prevRides,
      lens,
      compareWindow.from,
      compareWindow.to,
    );
  }, [prevRides, lens, compareWindow]);

  const serviceMix = useMemo(
    () => (rides ? buildServiceMix(rides) : {
      airport: 0, p2p: 0, hourly: 0, other: 0,
    }),
    [rides],
  );

  const topClients = useMemo(
    () => (rides ? buildTopClients(rides, clients) : []),
    [rides, clients],
  );

  const driverPayouts = useMemo(
    () => (rides ? buildDriverPayouts(rides, drivers, lens) : []),
    [rides, drivers, lens],
  );

  const windowDays = useMemo(() => {
    return Math.max(
      1,
      Math.round(
        (period.to.getTime() - period.from.getTime()) / 86400_000,
      ) + 1 - 0, // inclusive
    );
  }, [period]);

  // ── Expense allocations for the current window ─────────────────
  const fixedAllocatedCents = useMemo(
    () =>
      fixedExpenseAllocatedCents(fixedExpenses, period.from, period.to),
    [fixedExpenses, period.from, period.to],
  );
  const maintenanceAllocCents = useMemo(
    () => maintenanceAllocatedCents(maintenance, period.from, period.to),
    [maintenance, period.from, period.to],
  );
  const rideCostsActualCents = useMemo(() => {
    let total = 0;
    for (const c of rideCosts) total += c.actual_cents ?? c.estimated_cents;
    return total;
  }, [rideCosts]);
  const totalExpensesCents =
    fixedAllocatedCents + maintenanceAllocCents + rideCostsActualCents;

  // Previous window's costs for delta calculation.
  const prevTotalExpensesCents = useMemo(() => {
    if (!compareWindow) return 0;
    const fx = fixedExpenseAllocatedCents(
      fixedExpenses,
      compareWindow.from,
      compareWindow.to,
    );
    const mt = maintenanceAllocatedCents(
      maintenance,
      compareWindow.from,
      compareWindow.to,
    );
    const rc = prevRideCosts.reduce(
      (s, c) => s + (c.actual_cents ?? c.estimated_cents),
      0,
    );
    return fx + mt + rc;
  }, [fixedExpenses, maintenance, prevRideCosts, compareWindow]);

  const netProfitCents = (totals?.myEarned ?? 0) - totalExpensesCents;
  const prevNetProfitCents =
    (prevTotals?.myEarned ?? 0) - prevTotalExpensesCents;

  const netProfitDelta = useMemo(() => {
    if (!prevTotals) return null;
    if (prevNetProfitCents === 0) return null;
    return (
      (netProfitCents - prevNetProfitCents) / Math.abs(prevNetProfitCents)
    );
  }, [netProfitCents, prevNetProfitCents, prevTotals]);

  const hasAnyExpenses =
    fixedExpenses.length > 0 ||
    maintenance.length > 0 ||
    rideCosts.length > 0;

  // ── Per-vehicle expense breakdowns ─────────────────────────────
  const fuelByVehicle = useMemo(
    () => buildFuelByVehicle(rides ?? [], rideCosts),
    [rides, rideCosts],
  );
  const maintenanceByVehicle = useMemo(
    () =>
      maintenanceAllocatedCentsByVehicle(
        maintenance,
        period.from,
        period.to,
      ),
    [maintenance, period.from, period.to],
  );
  const fixedByVehicle = useMemo(
    () =>
      fixedExpenseAllocatedCentsByVehicle(
        fixedExpenses,
        period.from,
        period.to,
      ),
    [fixedExpenses, period.from, period.to],
  );

  const vehicleProf = useMemo(
    () =>
      rides
        ? buildVehicleProf(
            rides,
            vehicles,
            rideCosts,
            fuelByVehicle,
            maintenanceByVehicle,
            fixedByVehicle,
            windowDays,
          )
        : [],
    [
      rides,
      vehicles,
      rideCosts,
      fuelByVehicle,
      maintenanceByVehicle,
      fixedByVehicle,
      windowDays,
    ],
  );

  // Compute deltas (current vs comparison).
  const myIncomeDelta = useMemo(() => {
    if (!totals || !prevTotals) return null;
    if (prevTotals.myEarned === 0) return null;
    return (totals.myEarned - prevTotals.myEarned) / prevTotals.myEarned;
  }, [totals, prevTotals]);
  const fleetDelta = useMemo(() => {
    if (!totals || !prevTotals) return null;
    if (prevTotals.fleetEarned === 0) return null;
    return (
      (totals.fleetEarned - prevTotals.fleetEarned) / prevTotals.fleetEarned
    );
  }, [totals, prevTotals]);
  const avgDelta = useMemo(() => {
    if (!totals || !prevTotals) return null;
    if (prevTotals.avgCompletedCents === 0) return null;
    return (
      (totals.avgCompletedCents - prevTotals.avgCompletedCents) /
      prevTotals.avgCompletedCents
    );
  }, [totals, prevTotals]);

  // Sparkline for the KPI cards: downsample the current series into ~24 buckets.
  const sparkValues = useMemo(() => {
    if (series.length === 0) return [];
    const buckets = Math.min(24, series.length);
    const arr = Array(buckets).fill(0);
    series.forEach((p, i) => {
      const idx = Math.floor((i / series.length) * buckets);
      arr[idx] += p.cents;
    });
    return arr;
  }, [series]);

  const insights = useMemo(
    () =>
      buildInsights({
        myIncomeCents: totals?.myEarned ?? 0,
        fleetRevenueCents: totals?.fleetEarned ?? 0,
        myIncomeDelta,
        netProfitCents,
        totalExpensesCents,
        topClients,
        agingBuckets: [], // populated below — but Insights only needs totals
        hasCommissionConfigured: drivers.some(
          (d) =>
            !d.is_owner && (d.commission_rate_bps ?? 0) > 0,
        ),
        ownerDriverPresent: drivers.some((d) => d.is_owner === true),
        hasAnyExpenses,
        periodLabel: period.label,
      }),
    [
      totals,
      myIncomeDelta,
      netProfitCents,
      totalExpensesCents,
      topClients,
      drivers,
      hasAnyExpenses,
      period.label,
    ],
  );

  const prevLabel =
    compareMode === "yoy"
      ? "Same period last year"
      : "Previous period";

  return (
    <div>
      <EarningsPageHeader period={period} />

      {error ? (
        <div
          className="mb-5 rounded-[6px] p-4"
          style={{
            background: "color-mix(in oklab, var(--danger) 8%, var(--surface))",
            border: "1px solid var(--danger)",
            color: "var(--danger)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      {/* Date controls */}
      <EarningsDateControls
        periodId={periodId}
        setPeriodId={setPeriodId}
        compareMode={compareMode}
        setCompareMode={setCompareMode}
      />

      {/* KPI row */}
      <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <EarningsKpi
          label="My income"
          value={
            totals === null ? "—" : fmtMoney(totals.myEarned)
          }
          delta={myIncomeDelta}
          spark={sparkValues}
          sparkColor="var(--accent)"
          hint={
            totals === null
              ? undefined
              : `${totals.completedCount} ride${totals.completedCount === 1 ? "" : "s"} completed · ${period.label}`
          }
          accent
        />
        <EarningsKpi
          label={hasAnyExpenses ? "Net profit" : "Net profit · setup needed"}
          value={
            totals === null
              ? "—"
              : hasAnyExpenses
                ? fmtMoney(netProfitCents)
                : "—"
          }
          delta={hasAnyExpenses ? netProfitDelta : null}
          sparkColor={netProfitCents >= 0 ? "var(--success)" : "var(--danger)"}
          hint={
            hasAnyExpenses
              ? `${fmtMoney(totalExpensesCents)} in costs · ${totals && totals.myEarned > 0 ? Math.round((netProfitCents / totals.myEarned) * 100) : 0}% margin`
              : "Log fixed + per-ride costs on /expenses to see profit."
          }
        />
        <EarningsKpi
          label="Fleet revenue"
          value={totals === null ? "—" : fmtMoney(totals.fleetEarned)}
          delta={fleetDelta}
          sparkColor="var(--accent-strong)"
          hint={
            totals && totals.fleetEarned > totals.myEarned
              ? `${fmtMoney(totals.fleetEarned - totals.myEarned)} flowed to other drivers`
              : totals && totals.bookedCount - totals.completedCount > 0
                ? `${fmtMoney(Math.max(0, totals.myProjected - totals.myEarned))} of yours still on the books`
                : "Everything the fleet collected"
          }
        />
        <EarningsKpi
          label="Avg / completed ride"
          value={
            totals === null
              ? "—"
              : fmtMoney(totals.avgCompletedCents)
          }
          delta={avgDelta}
          hint={
            totals && totals.completedCount === 0
              ? "No completed rides yet in this window"
              : "Owner-side income per completed ride"
          }
          sparkColor="var(--accent)"
        />
      </section>

      {/* Big chart */}
      <section className="mt-6">
        <EarningsRevenueChart
          current={series}
          previous={prevSeries}
          prevLabel={prevLabel}
          emphasizeIncome
        />
      </section>

      {/* Insights + Mix + AR */}
      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <EarningsInsights insights={insights} />
        <div className="flex flex-col gap-6">
          <EarningsServiceMix buckets={serviceMix} />
          <EarningsARAging invoices={invoices} />
        </div>
      </section>

      {/* Top clients + forecast */}
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <EarningsTopClients
          rows={topClients}
          totalCents={totals?.fleetProjected ?? 0}
          showEarned
        />
        <EarningsForecast
          windowMyIncomeCents={totals?.myEarned ?? 0}
          windowDays={windowDays}
        />
      </section>

      {/* Drivers + Vehicles */}
      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <EarningsDriverPayouts rows={driverPayouts} />
        <EarningsVehicleProf rows={vehicleProf} />
      </section>

      <p
        className="text-muted mt-10 text-center"
        style={{ fontSize: 12 }}
      >
        Numbers update live as rides change. Times in America/Los_Angeles.
      </p>
    </div>
  );
}
