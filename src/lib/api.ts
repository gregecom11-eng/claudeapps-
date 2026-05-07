// Thin wrapper around Supabase queries the routes need. Keeping data
// access in one place makes it cheap to swap to a server proxy later if
// we want to hide Supabase-specific URLs.

import { supabase } from "./supabase";
import type {
  ActivityEvent,
  Client,
  Driver,
  Ride,
  Vehicle,
} from "./types";

// Returns every ride visible to the caller (RLS scoped). Filters only by
// pickup_at range and limit — intentionally NOT by source, driver_id, or
// vehicle_id, so MCP-created rides and unassigned rides always appear.
export async function listRides(opts?: {
  from?: string;
  to?: string;
  limit?: number;
}): Promise<Ride[]> {
  let q = supabase.from("rides").select("*").order("pickup_at", {
    ascending: true,
  });
  if (opts?.from) q = q.gte("pickup_at", opts.from);
  if (opts?.to) q = q.lte("pickup_at", opts.to);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getRide(id: string): Promise<Ride | null> {
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertRide(ride: Partial<Ride>): Promise<Ride> {
  const { data, error } = await supabase
    .from("rides")
    .upsert(ride)
    .select()
    .single();
  if (error) throw error;
  return data as Ride;
}

export async function updateRideStatus(
  id: string,
  status: Ride["status"],
): Promise<void> {
  const { error } = await supabase
    .from("rides")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteRide(id: string): Promise<void> {
  const { error } = await supabase.from("rides").delete().eq("id", id);
  if (error) throw error;
}

export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function listDrivers(): Promise<Driver[]> {
  const { data, error } = await supabase
    .from("drivers")
    .select("*")
    .eq("active", true)
    .order("full_name");
  if (error) throw error;
  return data ?? [];
}

export async function listVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("active", true)
    .order("display_name");
  if (error) throw error;
  return data ?? [];
}

// ── Client CRUD ────────────────────────────────────────────────────
export async function upsertClient(c: Partial<Client>): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .upsert(c)
    .select()
    .single();
  if (error) throw error;
  return data as Client;
}
export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

// ── Driver CRUD ────────────────────────────────────────────────────
// Soft-toggle via `active` column to preserve historical ride references.
export async function upsertDriver(d: Partial<Driver>): Promise<Driver> {
  const { data, error } = await supabase
    .from("drivers")
    .upsert(d)
    .select()
    .single();
  if (error) throw error;
  return data as Driver;
}
export async function setDriverActive(
  id: string,
  active: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("drivers")
    .update({ active })
    .eq("id", id);
  if (error) throw error;
}
// Returns active + inactive together; UI can split visually.
export async function listAllDrivers(): Promise<Driver[]> {
  const { data, error } = await supabase
    .from("drivers")
    .select("*")
    .order("active", { ascending: false })
    .order("full_name");
  if (error) throw error;
  return data ?? [];
}

// ── Vehicle CRUD ───────────────────────────────────────────────────
export async function upsertVehicle(v: Partial<Vehicle>): Promise<Vehicle> {
  const { data, error } = await supabase
    .from("vehicles")
    .upsert(v)
    .select()
    .single();
  if (error) throw error;
  return data as Vehicle;
}
export async function setVehicleActive(
  id: string,
  active: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("vehicles")
    .update({ active })
    .eq("id", id);
  if (error) throw error;
}
export async function listAllVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .order("active", { ascending: false })
    .order("display_name");
  if (error) throw error;
  return data ?? [];
}

// ── Driver (current user, scoped) ──────────────────────────────────
// Calls the security-definer RPC to link the current auth user to a
// drivers row by matching email. Returns the linked driver, or null if
// no driver record exists for this user yet.
export async function claimDriverByEmail(): Promise<Driver | null> {
  const { data, error } = await supabase.rpc("claim_driver_by_email");
  if (error) {
    // 404 / function not found → migration hasn't been run yet.
    throw error;
  }
  return (data as Driver | null) ?? null;
}

// "My today" / "my tomorrow" rely on RLS — RLS is what scopes the rows
// to the current driver. The same listRides() works.

// Generate a magic-link sign-in URL for the given email, server-side
// (uses Supabase admin API). Doesn't email — returns the URL so the
// dashboard can show it for the owner to copy and share via SMS, etc.
// Sidesteps Supabase's free-tier email rate limit (4/hr, 30/day).
export async function generateInviteLink(
  email: string,
): Promise<{ email: string; action_link: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");

  const res = await fetch("/api/invite", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ email }),
  });
  const body = (await res.json()) as {
    ok?: boolean;
    email?: string;
    action_link?: string;
    error?: string;
  };
  if (!res.ok || !body.action_link) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return { email: body.email ?? email, action_link: body.action_link };
}

// ── Profile (current user) ─────────────────────────────────────────
export async function updateMyProfile(patch: {
  full_name?: string | null;
  phone?: string | null;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id);
  if (error) throw error;
}

// ── Backup snapshot ───────────────────────────────────────────────
export async function exportSnapshot(): Promise<{
  exported_at: string;
  rides: unknown[];
  clients: unknown[];
  drivers: unknown[];
  vehicles: unknown[];
}> {
  const [rides, clients, drivers, vehicles] = await Promise.all([
    supabase.from("rides").select("*").then((r) => r.data ?? []),
    supabase.from("clients").select("*").then((r) => r.data ?? []),
    supabase.from("drivers").select("*").then((r) => r.data ?? []),
    supabase.from("vehicles").select("*").then((r) => r.data ?? []),
  ]);
  return {
    exported_at: new Date().toISOString(),
    rides,
    clients,
    drivers,
    vehicles,
  };
}

export async function listEvents(limit = 30): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
