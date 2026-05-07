// Tool catalog + executors. Each tool returns MCP-shaped content:
//   { content: [{ type: "text", text: "..." }], isError?: boolean }

import type { Env } from "./index";
import { adminClient } from "./supabase";

// ── Tool schemas exposed to Claude ────────────────────────────────────
export const TOOL_SCHEMAS = [
  {
    name: "create_ride",
    description:
      "Schedule a new ride in the SDLuxury Operations dashboard. Use this when the user describes a ride they want to add — even if not all details are provided. The ride appears immediately on the owner dashboard. Always confirm pickup_at and pickup_address with the user before calling.",
    inputSchema: {
      type: "object",
      properties: {
        passenger_name: { type: "string", description: "Full passenger name." },
        passenger_phone: {
          type: "string",
          description: "Passenger phone (optional).",
        },
        client_name: {
          type: "string",
          description:
            "Recurring client to link this ride to (e.g. 'Kevin Morgan'). If a client with this name exists, the ride is linked. If not, the ride is created without a client link.",
        },
        pickup_at: {
          type: "string",
          description:
            "Pickup date and time in ISO 8601 (e.g. '2026-04-29T07:15:00-07:00'). If the user gives a relative time ('tomorrow 7am'), resolve it to an absolute time in America/Los_Angeles before calling.",
        },
        pickup_address: { type: "string", description: "Pickup address." },
        dropoff_address: {
          type: "string",
          description: "Dropoff address (optional).",
        },
        flight_airline: { type: "string", description: "Optional airline." },
        flight_number: { type: "string", description: "Optional flight #." },
        flight_airport: {
          type: "string",
          description: "Airport code (e.g. LAX).",
        },
        flight_terminal: { type: "string", description: "Terminal." },
        driver_name: {
          type: "string",
          description:
            "Driver name to assign — fuzzy-matched against the active drivers list (Greg, Hassan, David Santiago, etc.). Use list_drivers if unsure.",
        },
        vehicle_name: {
          type: "string",
          description:
            "Vehicle to assign — fuzzy-matched against the fleet. Use list_vehicles if unsure.",
        },
        fare_dollars: { type: "number", description: "Base fare in dollars." },
        gratuity_dollars: { type: "number" },
        parking_dollars: { type: "number" },
        billing_terms: {
          type: "string",
          enum: [
            "cash",
            "card",
            "zelle",
            "net_15",
            "net_30",
            "company_billing",
          ],
        },
        notes: { type: "string", description: "Internal/driver notes." },
      },
      required: ["passenger_name", "pickup_at", "pickup_address"],
    },
  },
  {
    name: "list_rides",
    description:
      "Return rides on a given date or range. Use 'today', 'tomorrow', 'this_week', or an explicit YYYY-MM-DD. Optional status filter.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description:
            "'today' | 'tomorrow' | 'this_week' | 'next_week' | YYYY-MM-DD",
        },
        status: {
          type: "string",
          enum: [
            "requested",
            "scheduled",
            "in_progress",
            "completed",
            "cancelled",
          ],
        },
        limit: { type: "integer", default: 50 },
      },
    },
  },
  {
    name: "update_ride_status",
    description:
      "Change a ride's status (e.g. mark in progress / completed / cancelled). Identify the ride by id, or by passenger_name + date.",
    inputSchema: {
      type: "object",
      properties: {
        ride_id: { type: "string", description: "Exact UUID if known." },
        passenger_name: {
          type: "string",
          description: "Passenger name (used with date if no id given).",
        },
        date: {
          type: "string",
          description: "YYYY-MM-DD or 'today' / 'tomorrow' (used with passenger_name).",
        },
        new_status: {
          type: "string",
          enum: [
            "requested",
            "scheduled",
            "in_progress",
            "completed",
            "cancelled",
          ],
        },
      },
      required: ["new_status"],
    },
  },
  {
    name: "find_or_create_client",
    description:
      "Look up a recurring client by name. If not found, create them and return the new record. Useful before create_ride when the user mentions a new repeat client.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
        company: { type: "string" },
        email: { type: "string" },
        default_billing: {
          type: "string",
          enum: [
            "cash",
            "card",
            "zelle",
            "net_15",
            "net_30",
            "company_billing",
          ],
        },
      },
      required: ["name"],
    },
  },
  {
    name: "list_drivers",
    description: "List active drivers (id, name, phone).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_vehicles",
    description: "List active vehicles (id, name, plate).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "log_activity",
    description:
      "Append a free-form note to the dashboard's activity feed. Use this to leave a breadcrumb when something noteworthy happens that isn't a ride status change (e.g. 'Heartbeat: EJA 812 slipped to 14:45').",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string" },
        ride_id: { type: "string" },
        source: {
          type: "string",
          description:
            "Where the note came from. Defaults to 'mcp' (this connector).",
        },
      },
      required: ["message"],
    },
  },
] as const;

type ToolName = (typeof TOOL_SCHEMAS)[number]["name"];

// ── Executor ──────────────────────────────────────────────────────────
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  env: Env,
): Promise<{
  content: { type: "text"; text: string }[];
  isError?: boolean;
}> {
  try {
    switch (name as ToolName) {
      case "create_ride":
        return ok(await createRide(args, env));
      case "list_rides":
        return ok(await listRides(args, env));
      case "update_ride_status":
        return ok(await updateRideStatus(args, env));
      case "find_or_create_client":
        return ok(await findOrCreateClient(args, env));
      case "list_drivers":
        return ok(await listDrivers(env));
      case "list_vehicles":
        return ok(await listVehicles(env));
      case "log_activity":
        return ok(await logActivity(args, env));
      default:
        return err(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

const ok = (data: unknown) => ({
  content: [
    { type: "text" as const, text: JSON.stringify(data, null, 2) },
  ],
});
const err = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
  isError: true,
});

// ── Helpers ───────────────────────────────────────────────────────────
function dollarsToCents(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v * 100);
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return Math.round(n * 100);
  }
  return 0;
}

function s(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

function resolveDateRange(
  date: string | undefined,
): { from: string; to: string } | null {
  if (!date) return null;
  const tz = "America/Los_Angeles";
  const today = new Date();
  // Build a "now" anchored to LA time roughly — for ranges this is good enough.
  const anchor = new Date(today.toLocaleString("en-US", { timeZone: tz }));

  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };

  if (date === "today") {
    return {
      from: startOfDay(anchor).toISOString(),
      to: endOfDay(anchor).toISOString(),
    };
  }
  if (date === "tomorrow") {
    const t = new Date(anchor.getTime() + 24 * 60 * 60 * 1000);
    return { from: startOfDay(t).toISOString(), to: endOfDay(t).toISOString() };
  }
  if (date === "this_week") {
    const start = startOfDay(anchor);
    const end = endOfDay(new Date(start.getTime() + 6 * 86_400_000));
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (date === "next_week") {
    const start = startOfDay(
      new Date(anchor.getTime() + 7 * 86_400_000),
    );
    const end = endOfDay(new Date(start.getTime() + 6 * 86_400_000));
    return { from: start.toISOString(), to: end.toISOString() };
  }
  // Treat as YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (m) {
    const [, y, mo, d] = m;
    const start = new Date(`${y}-${mo}-${d}T00:00:00`);
    const end = new Date(`${y}-${mo}-${d}T23:59:59.999`);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  return null;
}

async function findDriverByName(
  env: Env,
  name: string,
): Promise<{ id: string; full_name: string } | null> {
  const sb = adminClient(env);
  const { data } = await sb
    .from("drivers")
    .select("id, full_name")
    .eq("active", true);
  if (!data) return null;
  const lower = name.toLowerCase();
  // Exact, contains, or first-word match
  let match = data.find((d) => d.full_name.toLowerCase() === lower);
  match = match || data.find((d) => d.full_name.toLowerCase().includes(lower));
  match =
    match ||
    data.find((d) => d.full_name.toLowerCase().split(/\W+/).includes(lower));
  return match ?? null;
}

async function findVehicleByName(
  env: Env,
  name: string,
): Promise<{ id: string; display_name: string } | null> {
  const sb = adminClient(env);
  const { data } = await sb
    .from("vehicles")
    .select("id, display_name, plate")
    .eq("active", true);
  if (!data) return null;
  const lower = name.toLowerCase();
  return (
    data.find((v) => v.display_name.toLowerCase() === lower) ??
    data.find((v) => v.display_name.toLowerCase().includes(lower)) ??
    data.find((v) => (v.plate ?? "").toLowerCase() === lower) ??
    null
  );
}

async function findClientByName(
  env: Env,
  name: string,
): Promise<{ id: string; name: string } | null> {
  const sb = adminClient(env);
  const { data } = await sb
    .from("clients")
    .select("id, name")
    .ilike("name", name);
  return data?.[0] ?? null;
}

// ── Tool implementations ──────────────────────────────────────────────
async function createRide(args: Record<string, unknown>, env: Env) {
  const sb = adminClient(env);
  const passenger_name = s(args.passenger_name);
  const pickup_at = s(args.pickup_at);
  const pickup_address = s(args.pickup_address);
  if (!passenger_name || !pickup_at || !pickup_address) {
    throw new Error(
      "passenger_name, pickup_at, and pickup_address are required.",
    );
  }
  // Validate ISO date.
  const t = new Date(pickup_at);
  if (Number.isNaN(t.getTime())) {
    throw new Error(`pickup_at is not a valid ISO 8601 datetime: ${pickup_at}`);
  }

  let client_id: string | null = null;
  if (s(args.client_name)) {
    const c = await findClientByName(env, s(args.client_name)!);
    client_id = c?.id ?? null;
  }

  let driver_id: string | null = null;
  if (s(args.driver_name)) {
    const d = await findDriverByName(env, s(args.driver_name)!);
    if (!d) {
      throw new Error(
        `Driver '${args.driver_name}' not found. Use list_drivers to see options.`,
      );
    }
    driver_id = d.id;
  }

  let vehicle_id: string | null = null;
  if (s(args.vehicle_name)) {
    const v = await findVehicleByName(env, s(args.vehicle_name)!);
    if (!v) {
      throw new Error(
        `Vehicle '${args.vehicle_name}' not found. Use list_vehicles to see options.`,
      );
    }
    vehicle_id = v.id;
  }

  const insert = {
    passenger_name,
    passenger_phone: s(args.passenger_phone) ?? null,
    client_id,
    pickup_at: t.toISOString(),
    pickup_address,
    dropoff_address: s(args.dropoff_address) ?? null,
    flight_airline: s(args.flight_airline) ?? null,
    flight_number: s(args.flight_number) ?? null,
    flight_airport: s(args.flight_airport) ?? null,
    flight_terminal: s(args.flight_terminal) ?? null,
    driver_id,
    vehicle_id,
    fare_cents: dollarsToCents(args.fare_dollars),
    gratuity_cents: dollarsToCents(args.gratuity_dollars),
    parking_cents: dollarsToCents(args.parking_dollars),
    billing_terms: s(args.billing_terms) ?? null,
    notes: s(args.notes) ?? null,
    status: "scheduled" as const,
    source: "mcp",
  };

  const { data, error } = await sb
    .from("rides")
    .insert(insert)
    .select()
    .single();
  if (error) throw new Error(error.message);

  return {
    ride_id: data.id,
    summary: `Created ride for ${data.passenger_name} at ${new Date(
      data.pickup_at,
    ).toLocaleString()}.`,
    ride: data,
  };
}

async function listRides(args: Record<string, unknown>, env: Env) {
  const sb = adminClient(env);
  const date = s(args.date) ?? "today";
  const range = resolveDateRange(date);
  const status = s(args.status);
  const limit = typeof args.limit === "number" ? args.limit : 50;

  let q = sb.from("rides").select("*").order("pickup_at", { ascending: true });
  if (range) q = q.gte("pickup_at", range.from).lte("pickup_at", range.to);
  if (status) q = q.eq("status", status);
  q = q.limit(Math.max(1, Math.min(200, limit)));

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return {
    range_label: date,
    range,
    count: data?.length ?? 0,
    rides: (data ?? []).map((r) => ({
      id: r.id,
      pickup_at: r.pickup_at,
      pickup_at_local: new Date(r.pickup_at).toLocaleString(),
      passenger_name: r.passenger_name,
      pickup_address: r.pickup_address,
      dropoff_address: r.dropoff_address,
      driver_id: r.driver_id,
      vehicle_id: r.vehicle_id,
      flight: r.flight_number
        ? `${r.flight_airline ?? ""} ${r.flight_number}`.trim()
        : null,
      status: r.status,
      total: (r.total_cents / 100).toFixed(2),
    })),
  };
}

async function updateRideStatus(args: Record<string, unknown>, env: Env) {
  const sb = adminClient(env);
  const new_status = s(args.new_status);
  if (!new_status) throw new Error("new_status is required.");

  let ride_id = s(args.ride_id) ?? null;
  if (!ride_id) {
    const passenger_name = s(args.passenger_name);
    const date = s(args.date);
    if (!passenger_name) {
      throw new Error("Either ride_id or passenger_name (+ date) is required.");
    }
    const range = date ? resolveDateRange(date) : null;
    let q = sb
      .from("rides")
      .select("id, passenger_name, pickup_at")
      .ilike("passenger_name", `%${passenger_name}%`);
    if (range) q = q.gte("pickup_at", range.from).lte("pickup_at", range.to);
    const { data, error } = await q.order("pickup_at", { ascending: true });
    if (error) throw new Error(error.message);
    if (!data || data.length === 0)
      throw new Error(`No ride found for '${passenger_name}'.`);
    if (data.length > 1)
      throw new Error(
        `Multiple rides match '${passenger_name}'. Pass ride_id explicitly: ${data
          .map((r) => `${r.id} (${new Date(r.pickup_at).toLocaleString()})`)
          .join(", ")}`,
      );
    ride_id = data[0].id;
  }

  const { data, error } = await sb
    .from("rides")
    .update({ status: new_status })
    .eq("id", ride_id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return {
    ride_id: data.id,
    new_status: data.status,
    summary: `Set ${data.passenger_name}'s ride to ${data.status}.`,
  };
}

async function findOrCreateClient(args: Record<string, unknown>, env: Env) {
  const sb = adminClient(env);
  const name = s(args.name);
  if (!name) throw new Error("name is required.");
  const existing = await findClientByName(env, name);
  if (existing) {
    const { data } = await sb
      .from("clients")
      .select("*")
      .eq("id", existing.id)
      .single();
    return { found: true, client: data };
  }
  const { data, error } = await sb
    .from("clients")
    .insert({
      name,
      phone: s(args.phone) ?? null,
      company: s(args.company) ?? null,
      email: s(args.email) ?? null,
      default_billing: s(args.default_billing) ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { found: false, created: true, client: data };
}

async function listDrivers(env: Env) {
  const sb = adminClient(env);
  const { data, error } = await sb
    .from("drivers")
    .select("id, full_name, phone")
    .eq("active", true)
    .order("full_name");
  if (error) throw new Error(error.message);
  return { drivers: data ?? [] };
}

async function listVehicles(env: Env) {
  const sb = adminClient(env);
  const { data, error } = await sb
    .from("vehicles")
    .select("id, display_name, plate, year, make, model")
    .eq("active", true)
    .order("display_name");
  if (error) throw new Error(error.message);
  return { vehicles: data ?? [] };
}

async function logActivity(args: Record<string, unknown>, env: Env) {
  const sb = adminClient(env);
  const message = s(args.message);
  if (!message) throw new Error("message is required.");
  const { data, error } = await sb
    .from("events")
    .insert({
      message,
      source: s(args.source) ?? "mcp",
      ride_id: s(args.ride_id) ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { event_id: data.id, summary: "Logged." };
}
