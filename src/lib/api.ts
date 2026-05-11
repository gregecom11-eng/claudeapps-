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
): Promise<Ride> {
  // Use .select().single() so a 0-row update (RLS rejection, wrong id,
  // etc.) raises an error instead of silently succeeding.
  const { data, error } = await supabase
    .from("rides")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (error.code === "PGRST116") {
      throw new Error(
        "Update was blocked — likely a permissions or trigger issue.",
      );
    }
    throw error;
  }
  return data as Ride;
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

// ── Client (current user, scoped) ──────────────────────────────────
export async function claimClientByEmail(): Promise<Client | null> {
  const { data, error } = await supabase.rpc("claim_client_by_email");
  if (error) throw error;
  return (data as Client | null) ?? null;
}

// ── Public booking submission (no auth required) ────────────────
export async function submitBookingRequest(input: {
  passenger_name: string;
  passenger_phone?: string;
  passenger_email?: string;
  pickup_at: string; // ISO
  pickup_address: string;
  dropoff_address?: string;
  trip_type?: string;
  notes?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("submit_booking_request", {
    p_passenger_name: input.passenger_name,
    p_passenger_phone: input.passenger_phone ?? "",
    p_passenger_email: input.passenger_email ?? "",
    p_pickup_at: input.pickup_at,
    p_pickup_address: input.pickup_address,
    p_dropoff_address: input.dropoff_address ?? "",
    p_trip_type: input.trip_type ?? "",
    p_notes: input.notes ?? "",
  });
  if (error) throw error;
  return data as string;
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

// Driver self-service — toggle availability and choose a default vehicle.
// Both run through a security-definer RPC because driver rows aren't
// writable under RLS. Returns the updated driver row, or null if the
// 09_driver_status.sql migration hasn't been applied yet.
export async function updateMyDriverSelf(patch: {
  available?: boolean;
  default_vehicle_id?: string | null;
}): Promise<Driver | null> {
  // Clearing the vehicle preference needs a dedicated RPC since the
  // updater coalesces nulls (can't tell "leave alone" from "clear").
  if (patch.default_vehicle_id === null) {
    const { data, error } = await supabase.rpc("clear_my_default_vehicle");
    if (error) throw error;
    if (patch.available === undefined) return (data as Driver | null) ?? null;
  }
  const { data, error } = await supabase.rpc("update_my_driver_self", {
    p_available: patch.available ?? null,
    p_default_vehicle_id:
      patch.default_vehicle_id === null ? null : patch.default_vehicle_id,
  });
  if (error) throw error;
  return (data as Driver | null) ?? null;
}

// Cheap heartbeat — bumps drivers.last_seen_at for the current user.
// Soft-fails so a missing migration never breaks the Today screen.
export async function markDriverSeen(): Promise<void> {
  try {
    await supabase.rpc("mark_driver_seen");
  } catch {
    /* migration not applied yet — silent no-op */
  }
}

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

// Generate a fresh VAPID keypair on the server (one-time, owner-only).
// The keys are NOT stored — the operator pastes them into Cloudflare
// secrets. Reloading this generates fresh keys and breaks any existing
// subscriptions, so call once and save the result.
export async function generateVapidKeys(): Promise<{
  publicKey: string;
  privateKey: string;
  subject: string;
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const res = await fetch("/api/push/vapid-setup", {
    headers: { authorization: `Bearer ${session.access_token}` },
  });
  const body = (await res.json()) as {
    ok?: boolean;
    secrets?: {
      VAPID_PUBLIC_KEY: string;
      VAPID_PRIVATE_KEY: string;
      VAPID_SUBJECT: string;
    };
    error?: string;
  };
  if (!res.ok || !body.secrets) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return {
    publicKey: body.secrets.VAPID_PUBLIC_KEY,
    privateKey: body.secrets.VAPID_PRIVATE_KEY,
    subject: body.secrets.VAPID_SUBJECT,
  };
}

// Probe whether VAPID is currently configured on the worker. Returns
// true if /api/push/vapid-public returns a key, false otherwise.
export async function isVapidConfigured(): Promise<boolean> {
  try {
    const res = await fetch("/api/push/vapid-public");
    return res.ok;
  } catch {
    return false;
  }
}

// ── Notification preferences (current user) ────────────────────────
export async function listMyNotificationPrefs(): Promise<
  import("./types").NotificationPref[]
> {
  const { data, error } = await supabase
    .from("notification_prefs")
    .select("*");
  if (error) throw error;
  return (data ?? []) as import("./types").NotificationPref[];
}

export async function setNotificationPref(
  kind: import("./types").NotificationKind,
  enabled: boolean,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase
    .from("notification_prefs")
    .upsert(
      { user_id: user.id, kind, enabled },
      { onConflict: "user_id,kind" },
    );
  if (error) throw error;
}

export async function getMyQuietHours(): Promise<
  import("./types").QuietHours | null
> {
  const { data, error } = await supabase
    .from("notification_quiet_hours")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as import("./types").QuietHours | null) ?? null;
}

export async function upsertMyQuietHours(qh: {
  start_local: string;
  end_local: string;
  tz?: string;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase.from("notification_quiet_hours").upsert(
    {
      user_id: user.id,
      start_local: qh.start_local,
      end_local: qh.end_local,
      tz: qh.tz ?? "America/Los_Angeles",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

// Send a "you're wired up" push to every device of the current user.
// Useful as a self-test in Settings.
export async function sendTestNotification(): Promise<{
  sent: number;
  failed: number;
  devices: number;
}> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error("Not signed in");
  const res = await fetch("/api/push/test", {
    method: "POST",
    headers: { authorization: `Bearer ${session.access_token}` },
  });
  const body = (await res.json()) as {
    sent?: number;
    failed?: number;
    devices?: number;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return {
    sent: body.sent ?? 0,
    failed: body.failed ?? 0,
    devices: body.devices ?? 0,
  };
}

// ── Notification inbox / activity log ──────────────────────────────
export async function listNotificationInbox(opts?: {
  limit?: number;
}): Promise<import("./types").NotificationInboxRow[]> {
  let q = supabase
    .from("notification_inbox")
    .select("*")
    .order("created_at", { ascending: false });
  q = q.limit(opts?.limit ?? 100);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as import("./types").NotificationInboxRow[];
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

// ── Ride extras (stops, additional services) ──────────────────────
export async function listRideExtras(rideId: string) {
  const { data, error } = await supabase
    .from("ride_extras")
    .select("*")
    .eq("ride_id", rideId)
    .order("added_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as import("./types").RideExtra[];
}

export async function addRideExtra(
  rideId: string,
  description: string,
  amount_cents: number,
): Promise<import("./types").RideExtra> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("ride_extras")
    .insert({
      ride_id: rideId,
      description: description.trim(),
      amount_cents,
      added_by: user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as import("./types").RideExtra;
}

export async function deleteRideExtra(id: string): Promise<void> {
  const { error } = await supabase.from("ride_extras").delete().eq("id", id);
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

// ── Invoices ───────────────────────────────────────────────────────
export async function listInvoices(): Promise<import("./types").Invoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as import("./types").Invoice[];
}

export async function nextInvoiceNumber(): Promise<string> {
  const { data, error } = await supabase.rpc("next_invoice_number");
  if (error) throw error;
  return data as string;
}

export async function createInvoiceForRide(
  rideId: string,
  amount_cents: number,
  terms?: import("./types").BillingTerms | null,
  due_date?: string | null,
): Promise<import("./types").Invoice> {
  const number = await nextInvoiceNumber();
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      ride_id: rideId,
      number,
      amount_cents,
      terms: terms ?? null,
      due_date: due_date ?? null,
      status: "sent",
    })
    .select()
    .single();
  if (error) throw error;
  return data as import("./types").Invoice;
}

export async function updateInvoice(
  id: string,
  patch: Partial<import("./types").Invoice>,
): Promise<import("./types").Invoice> {
  const { data, error } = await supabase
    .from("invoices")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as import("./types").Invoice;
}

export async function markInvoicePaid(id: string): Promise<void> {
  await updateInvoice(id, {
    status: "paid",
    paid_at: new Date().toISOString(),
  });
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;
}

// ── Org settings (singleton) ───────────────────────────────────────
export async function getOrgSettings(): Promise<{
  brand_name: string | null;
  dispatch_phone: string | null;
  dispatch_email: string | null;
  invoice_prefix: string | null;
}> {
  const { data, error } = await supabase
    .from("org_settings")
    .select("brand_name, dispatch_phone, dispatch_email, invoice_prefix")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data;
}

export async function updateOrgSettings(patch: {
  brand_name?: string | null;
  dispatch_phone?: string | null;
  dispatch_email?: string | null;
  invoice_prefix?: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("org_settings")
    .update(patch)
    .eq("id", 1);
  if (error) throw error;
}

// ── AI generation (server-side, falls back gracefully) ─────────────
export async function generatePacketText(
  kind: "confirmation" | "briefing" | "waybill" | "invoice",
  context: Record<string, unknown>,
): Promise<{ text: string; model: string } | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ kind, context }),
  });
  if (res.status === 503) return null; // No API key configured.
  const body = (await res.json()) as {
    ok?: boolean;
    text?: string;
    model?: string;
    error?: string;
  };
  if (!res.ok || !body.text) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return { text: body.text, model: body.model ?? "claude" };
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

// Status-change events for a single ride. Used by the driver sheet to
// stamp "Arrived 11:12 AM" alongside the progress strip.
export async function listRideEvents(
  rideId: string,
): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("ride_id", rideId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Driver + vehicle for a ride the caller owns. Uses a security-definer
// RPC because clients have no SELECT on drivers/vehicles under RLS.
// Returns null when the caller doesn't have access or the ride has no
// driver/vehicle assigned yet.
export async function getMyRideDetails(rideId: string): Promise<{
  driver_full_name: string | null;
  driver_phone: string | null;
  vehicle_display_name: string | null;
  vehicle_color: string | null;
  vehicle_plate: string | null;
} | null> {
  const { data, error } = await supabase.rpc("get_my_ride_details", {
    p_ride_id: rideId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    driver_full_name: row.driver_full_name ?? null,
    driver_phone: row.driver_phone ?? null,
    vehicle_display_name: row.vehicle_display_name ?? null,
    vehicle_color: row.vehicle_color ?? null,
    vehicle_plate: row.vehicle_plate ?? null,
  };
}

// Past rides for the same passenger (matched by name OR client_id).
// Used by the "passenger history" card on the driver ride sheet.
export async function listPassengerHistory(
  ride: Ride,
): Promise<Ride[]> {
  let q = supabase
    .from("rides")
    .select("*")
    .eq("status", "completed")
    .neq("id", ride.id)
    .order("pickup_at", { ascending: false })
    .limit(20);
  if (ride.client_id) {
    q = q.eq("client_id", ride.client_id);
  } else {
    q = q.eq("passenger_name", ride.passenger_name);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// ── Driver post-trip notes ────────────────────────────────────────
// Driver can annotate a ride after the fact ("address is around the
// back", "passenger asked for water"). Distinct from the dispatch
// `notes` field. Goes through a security-definer RPC because drivers
// can only update `status` directly under RLS.
export async function setDriverNotes(
  rideId: string,
  notes: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("set_driver_notes", {
    p_ride_id: rideId,
    p_notes: notes,
  });
  if (error) throw error;
}
