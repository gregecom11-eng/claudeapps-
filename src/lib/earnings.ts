// Earnings math.
//
// Two perspectives on every ride, kept distinct because they answer
// different questions:
//
//   Fleet revenue — what the company collected, regardless of who drove.
//   My income     — what the owner-operator personally takes home:
//                   * an owner-flagged driver drove it → 100% of total
//                   * nobody assigned yet              → 100% of total
//                     (a solo operator covers their own unassigned
//                      rides; "not another driver's" means it's yours)
//                   * another driver drove it          → company-
//                     commission share of the total (0 until rates set)
//
// The owner can have MORE THAN ONE driver row flagged is_owner — people
// accumulate identities over time ("Greg V", "Greg Business"). Every
// owner-flagged row's rides count fully.
//
// "Earned" = ride is completed. "Projected" = non-cancelled, includes
// earned. "Remaining" = projected − earned.

import type { Driver, Ride } from "./types";

export type OwnerLens = {
  // Every driver row flagged is_owner. Rides driven by any of them — or
  // by nobody — count fully as the owner's income.
  ownerDriverIds: Set<string>;
  // driver_id → company-share basis points (0..10000). Used to compute
  // the owner's cut when a NON-owner driver runs a ride.
  driverCommissionBps: Map<string, number>;
};

export function buildOwnerLens(drivers: Driver[]): OwnerLens {
  const ownerDriverIds = new Set<string>();
  const map = new Map<string, number>();
  for (const d of drivers) {
    if (d.is_owner === true) ownerDriverIds.add(d.id);
    const bps = typeof d.commission_rate_bps === "number"
      ? Math.max(0, Math.min(10000, d.commission_rate_bps))
      : 0;
    map.set(d.id, bps);
  }
  return { ownerDriverIds, driverCommissionBps: map };
}

// Whether the workspace has at least one owner-flagged driver.
export function hasOwnerDriver(lens: OwnerLens): boolean {
  return lens.ownerDriverIds.size > 0;
}

// Share of a ride's total_cents that lands in the owner's pocket.
// Ignores ride status — callers compose with earned/projected predicates.
function ownerShareCents(ride: Ride, lens: OwnerLens): number {
  // Unassigned → the owner covers it (solo-operator default).
  if (!ride.driver_id) return ride.total_cents;
  // An owner-flagged driver → 100% theirs.
  if (lens.ownerDriverIds.has(ride.driver_id)) return ride.total_cents;
  // Another driver → only the commission share.
  const bps = lens.driverCommissionBps.get(ride.driver_id) ?? 0;
  if (bps === 0) return 0;
  return Math.round((ride.total_cents * bps) / 10000);
}

// True when this ride's revenue is fully the owner's (drove it or it's
// unassigned). Used by driver-payout grouping.
export function isOwnerRide(ride: Ride, lens: OwnerLens): boolean {
  return !ride.driver_id || lens.ownerDriverIds.has(ride.driver_id);
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
