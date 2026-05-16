// Expense math — allocation + amortization helpers used by the
// Earnings page and the /expenses page.
//
// Three flavors of cost:
//
//   Fixed expenses (insurance, lease, phone, software, rent) live as
//   monthly/weekly/annual records with effective_from/effective_to.
//   Allocate to a window: convert to a per-day rate, multiply by the
//   number of days the record is active inside the window.
//
//   Per-ride costs (gas, tolls, parking, amenities) attach to specific
//   rides. Use actual_cents when available, fall back to estimated_cents
//   so projections show even before the driver confirms.
//
//   Maintenance is one-time service spend that covers a service interval
//   (oil = ~90d, tires = ~3y, etc.). Amortize: spread the cost evenly
//   across service_interval_days starting at serviced_at. Records
//   without an interval count once on the service date.

import type {
  ExpenseFixed,
  RideCost,
  VehicleMaintenance,
} from "./types";

const MS_PER_DAY = 86_400_000;

function asUTCStartOfDay(s: string): number {
  // s is "YYYY-MM-DD". Treat as UTC midnight so the math is stable
  // across DST shifts. Allocation precision is per-day, not per-hour.
  return new Date(s + "T00:00:00.000Z").getTime();
}

function clampToWindow(
  fromMs: number,
  toMs: number,
  effectiveFromMs: number,
  effectiveToMs: number,
): number {
  // Returns the number of inclusive days the [effectiveFrom..effectiveTo]
  // span overlaps with the [from..to] window. 0 if no overlap.
  const a = Math.max(fromMs, effectiveFromMs);
  const b = Math.min(toMs, effectiveToMs);
  if (b < a) return 0;
  return Math.floor((b - a) / MS_PER_DAY) + 1;
}

// ── Fixed expenses ─────────────────────────────────────────────
//
// Daily rate by cadence. Use round-number divisors so the numbers
// stay legible (a monthly cost shows as "≈ /30 per day"), not because
// it's astronomically precise.
function dailyRateCents(e: ExpenseFixed): number {
  switch (e.cadence) {
    case "weekly":  return e.amount_cents / 7;
    case "monthly": return e.amount_cents / 30;
    case "annual":  return e.amount_cents / 365;
  }
}

export function fixedExpenseAllocatedCents(
  expenses: ExpenseFixed[],
  windowFrom: Date,
  windowTo: Date,
): number {
  const fromMs = windowFrom.getTime();
  const toMs = windowTo.getTime();
  let total = 0;
  for (const e of expenses) {
    const efFromMs = asUTCStartOfDay(e.effective_from);
    const efToMs = e.effective_to
      ? asUTCStartOfDay(e.effective_to) + MS_PER_DAY - 1
      : Number.MAX_SAFE_INTEGER;
    const overlap = clampToWindow(fromMs, toMs, efFromMs, efToMs);
    total += dailyRateCents(e) * overlap;
  }
  return Math.round(total);
}

// ── Per-ride costs ─────────────────────────────────────────────
//
// Two views: "estimated" uses the projection, "actual" prefers
// confirmed amounts and falls back to estimate for unconfirmed lines.

export function rideCostEstimatedCents(costs: RideCost[]): number {
  return costs.reduce((s, c) => s + c.estimated_cents, 0);
}

export function rideCostActualCents(costs: RideCost[]): number {
  // Prefer actual where confirmed, else fall back to estimated so the
  // number isn't artificially low while drivers are still confirming.
  return costs.reduce(
    (s, c) => s + (c.actual_cents ?? c.estimated_cents),
    0,
  );
}

export function rideCostConfirmedActualCents(costs: RideCost[]): number {
  // Strict actual — only counts confirmed amounts. Used when the user
  // wants the "as of now, what's truly tallied" number.
  return costs.reduce((s, c) => s + (c.actual_cents ?? 0), 0);
}

// ── Maintenance amortization ──────────────────────────────────
//
// A service with an interval spreads evenly forward from serviced_at:
//   $90 oil change, 90-day interval, serviced May 1 → $1/day, May 1..Jul 29.
// A service without an interval lands once on serviced_at.

export function maintenanceAllocatedCents(
  records: VehicleMaintenance[],
  windowFrom: Date,
  windowTo: Date,
): number {
  const fromMs = windowFrom.getTime();
  const toMs = windowTo.getTime();
  let total = 0;
  for (const m of records) {
    const startMs = asUTCStartOfDay(m.serviced_at);
    if (m.service_interval_days && m.service_interval_days > 0) {
      const endMs = startMs + m.service_interval_days * MS_PER_DAY - 1;
      const overlapDays = clampToWindow(fromMs, toMs, startMs, endMs);
      total += (m.amount_cents / m.service_interval_days) * overlapDays;
    } else {
      // Lump sum: counts once if serviced_at falls inside the window.
      if (startMs >= fromMs && startMs <= toMs) {
        total += m.amount_cents;
      }
    }
  }
  return Math.round(total);
}

// Same idea, but per-vehicle — so the Earnings page can light up the
// "vehicle profitability" panel.
export function maintenanceAllocatedCentsByVehicle(
  records: VehicleMaintenance[],
  windowFrom: Date,
  windowTo: Date,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of records) {
    const cents = maintenanceAllocatedCents([m], windowFrom, windowTo);
    out.set(m.vehicle_id, (out.get(m.vehicle_id) ?? 0) + cents);
  }
  return out;
}

// Same for fixed expenses tied to a specific vehicle.
export function fixedExpenseAllocatedCentsByVehicle(
  expenses: ExpenseFixed[],
  windowFrom: Date,
  windowTo: Date,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of expenses) {
    if (!e.vehicle_id) continue;
    const cents = fixedExpenseAllocatedCents([e], windowFrom, windowTo);
    out.set(e.vehicle_id, (out.get(e.vehicle_id) ?? 0) + cents);
  }
  return out;
}

// ── Catalog ────────────────────────────────────────────────────

export const FIXED_CATEGORY_LABEL: Record<
  ExpenseFixed["category"],
  string
> = {
  insurance: "Insurance",
  lease: "Lease / loan",
  phone: "Phone",
  software: "Software",
  rent: "Rent / garage",
  subscription: "Subscription",
  other: "Other",
};

export const FIXED_CADENCE_LABEL: Record<
  ExpenseFixed["cadence"],
  string
> = {
  weekly: "weekly",
  monthly: "monthly",
  annual: "annually",
};

export const RIDE_COST_CATEGORY_LABEL: Record<
  RideCost["category"],
  string
> = {
  gas: "Gas",
  tolls: "Tolls",
  parking: "Parking",
  amenities: "Amenities",
  tip_out: "Tip-out",
  other: "Other",
};

export const MAINTENANCE_CATEGORY_LABEL: Record<
  VehicleMaintenance["category"],
  string
> = {
  oil: "Oil change",
  tires: "Tires",
  brakes: "Brakes",
  detailing: "Detailing",
  registration: "Registration",
  smog: "Smog",
  repair: "Repair",
  other: "Other",
};
