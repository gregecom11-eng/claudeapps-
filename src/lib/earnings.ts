// Earnings math.
//
// Two perspectives on every ride, kept distinct because they answer
// different questions:
//
//   Fleet revenue — what the company collected, regardless of who drove.
//   My income     — what the owner-operator personally takes home:
//                   * owner drove the ride         → 100% of the total
//                   * another driver drove it      → company-commission
//                                                    share of the total
//                                                    (today defaults to 0)
//                   * nobody assigned yet          → $0 (don't speculate)
//
// "Earned" = ride is completed. "Projected" = non-cancelled, includes
// earned. "Remaining" = projected − earned.

import type { Driver, Ride } from "./types";

export type OwnerLens = {
  ownerDriverId: string | null;
  // driver_id → company-share basis points (0..10000). Used to compute
  // the owner's cut when a non-owner driver runs a ride.
  driverCommissionBps: Map<string, number>;
};

export function buildOwnerLens(drivers: Driver[]): OwnerLens {
  const owner = drivers.find((d) => d.is_owner === true) ?? null;
  const map = new Map<string, number>();
  for (const d of drivers) {
    const bps = typeof d.commission_rate_bps === "number"
      ? Math.max(0, Math.min(10000, d.commission_rate_bps))
      : 0;
    map.set(d.id, bps);
  }
  return {
    ownerDriverId: owner?.id ?? null,
    driverCommissionBps: map,
  };
}

// Share of a ride's total_cents that lands in the owner's pocket.
// Ignores ride status — callers compose with earned/projected predicates.
function ownerShareCents(ride: Ride, lens: OwnerLens): number {
  if (!ride.driver_id) return 0;
  if (ride.driver_id === lens.ownerDriverId) return ride.total_cents;
  const bps = lens.driverCommissionBps.get(ride.driver_id) ?? 0;
  if (bps === 0) return 0;
  return Math.round((ride.total_cents * bps) / 10000);
}

export function myEarnedCents(ride: Ride, lens: OwnerLens): number {
  if (ride.status !== "completed") return 0;
  return ownerShareCents(ride, lens);
}

export function myProjectedCents(ride: Ride, lens: OwnerLens): number {
  if (ride.status === "cancelled") return 0;
  return ownerShareCents(ride, lens);
}

export function fleetEarnedCents(ride: Ride): number {
  if (ride.status !== "completed") return 0;
  return ride.total_cents;
}

export function fleetProjectedCents(ride: Ride): number {
  if (ride.status === "cancelled") return 0;
  return ride.total_cents;
}

// ── Trip-type inference ──────────────────────────────────────────
//
// The rides table doesn't have a trip_type column yet, so we infer one
// from the fields we do have. Stable enough for the revenue-mix donut;
// will be replaced when an explicit column lands.

export type TripType = "airport" | "p2p" | "hourly" | "other";

export function inferTripType(ride: Ride): TripType {
  if (ride.flight_number || ride.flight_airport) return "airport";
  if (ride.dropoff_address && ride.dropoff_address.trim().length > 0) {
    return "p2p";
  }
  return "hourly";
}

export const TRIP_TYPE_LABEL: Record<TripType, string> = {
  airport: "Airport transfer",
  p2p: "Point to point",
  hourly: "Hourly chauffeur",
  other: "Other",
};
