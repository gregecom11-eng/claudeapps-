// Tool catalog + executors. Each tool returns MCP-shaped content:
//   { content: [{ type: "text", text: "..." }], isError?: boolean }

import type { Env } from "./index";
import { summarizeChanges, summarizeRideChanges } from "./pii";
import { adminClient } from "./supabase";

// Tool errors carry an HTTP-style status the caller can render even though
// the MCP transport only returns JSON-RPC. The status is stamped into the
// error payload (`{ error, status, ... }`) by executeTool().
export class ToolError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

// Capped at 50 rows per list call (security hardening: prevents a single
// compromised request from dumping the whole database).
const MAX_PAGE = 50;
const BILLING_TERMS = [
  "cash",
  "card",
  "zelle",
  "net_15",
  "net_30",
  "company_billing",
] as const;

// Fields the worker can target on an update_ride patch. Order is used in
// the audit's changed_fields output for stable diffing in tests.
const UPDATABLE_RIDE_FIELDS = [
  "pickup_at",
  "pickup_address",
  "dropoff_address",
  "fare_cents",
  "gratuity_cents",
  "parking_cents",
  "driver_id",
  "vehicle_id",
  "flight_airline",
  "flight_number",
  "flight_airport",
  "flight_terminal",
  "billing_terms",
  "passenger_phone",
  "passenger_name",
  "notes",
] as const;

// Order used for the changed_fields output of update_client.
// `name` is identifier-only — it does not appear here.
const UPDATABLE_CLIENT_FIELDS = [
  "phone",
  "email",
  "company",
  "default_billing",
  "home_address",
  "previous_addresses",
  "status",
  "notes",
] as const;

// Order used for the changed_fields output of update_driver.
// `full_name` is identifier-only — it does not appear here.
const UPDATABLE_DRIVER_FIELDS = [
  "phone",
  "email",
  "default_split",
  "vehicle_name",
  "status",
  "notes",
] as const;

const CLIENT_STATUSES = ["active", "inactive"] as const;
const DRIVER_STATUSES = ["active", "inactive"] as const;

export const TOOL_SCHEMAS = [
  {
    name: "create_ride",
    description:
      "Schedule a new ride in the SDLuxury Operations dashboard. Use this when the user describes a ride they want to add. The ride appears immediately on the owner dashboard. Always confirm pickup_at and pickup_address before calling.",
    inputSchema: {
      type: "object",
      properties: {
        passenger_name: { type: "string" },
        passenger_phone: { type: "string" },
        client_name: {
          type: "string",
          description:
            "Recurring client to link this ride to. If a client with this name exists, the ride is linked.",
        },
        pickup_at: {
          type: "string",
          description:
            "ISO 8601 datetime, e.g. '2026-04-29T07:15:00-07:00'. Resolve relative times to absolute in America/Los_Angeles before calling.",
        },
        pickup_address: { type: "string" },
        dropoff_address: { type: "string" },
        flight_airline: { type: "string" },
        flight_number: { type: "string" },
        flight_airport: { type: "string" },
        flight_terminal: { type: "string" },
        driver_name: {
          type: "string",
          description: "Driver name; fuzzy-matched. Use list_drivers if unsure.",
        },
        vehicle_name: {
          type: "string",
          description: "Vehicle; fuzzy-matched. Use list_vehicles if unsure.",
        },
        fare_dollars: { type: "number" },
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
        notes: { type: "string" },
      },
      required: ["passenger_name", "pickup_at", "pickup_address"],
    },
  },
  {
    name: "list_rides",
    description:
      "Return rides in a date range, anchored to Pacific calendar days (America/Los_Angeles). Each day runs 00:00:00.000 through 23:59:59.999 Pacific; late-night rides count toward the day they were worked, not the next. Pass `start_date` and/or `end_date` (YYYY-MM-DD) for explicit ranges, or `date` for keyword shortcuts (today, tomorrow, this_week, next_week, or a single YYYY-MM-DD). Paginate via the opaque `cursor`. Default: today only.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description:
            "Keyword (today | tomorrow | this_week | next_week) or a single YYYY-MM-DD Pacific calendar date. Ignored when start_date or end_date is also passed.",
        },
        start_date: {
          type: "string",
          description:
            "YYYY-MM-DD Pacific calendar date. Range starts at 00:00:00.000 Pacific on this day.",
        },
        end_date: {
          type: "string",
          description:
            "YYYY-MM-DD Pacific calendar date. Range ends at 23:59:59.999 Pacific on this day. When omitted while start_date is given, defaults to today (Pacific).",
        },
        status: {
          type: "string",
          enum: [
            "requested",
            "scheduled",
            "on_the_way",
            "arrived",
            "in_progress",
            "completed",
            "cancelled",
          ],
        },
        limit: { type: "integer" },
        cursor: {
          type: "string",
          description:
            "Opaque cursor returned in `next_cursor` of a previous response.",
        },
      },
    },
  },
  {
    name: "update_ride_status",
    description:
      "Change a ride's status. Identify by ride_id (UUID), or by passenger_name + date.",
    inputSchema: {
      type: "object",
      properties: {
        ride_id: { type: "string" },
        passenger_name: { type: "string" },
        date: { type: "string" },
        new_status: {
          type: "string",
          enum: [
            "requested",
            "scheduled",
            "on_the_way",
            "arrived",
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
      "Look up a recurring client by name. If not found, create them and return the new record.",
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
      "Append a free-form note to the dashboard's activity feed.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string" },
        ride_id: { type: "string" },
        source: { type: "string" },
      },
      required: ["message"],
    },
  },
  {
    name: "update_ride",
    description: [
      "Edit any combination of fields on an existing ride without",
      "destroying data. Only `ride_id` is required; any field you don't",
      "pass is left untouched.",
      "",
      "Use this when the operator says something like \"change Greg's",
      "pickup to 8:30\", \"the fare should be $250 not $200\", or",
      "\"swap the driver to Hassan\". For status changes, use",
      "`update_ride_status` instead.",
      "",
      "Special behaviors:",
      "  - `notes` is APPENDED (timestamped, never overwritten).",
      "  - `billing_terms` enum values: cash | card | zelle | net_15 |",
      "    net_30 | company_billing.",
      "  - `driver_name` and `vehicle_name` are fuzzy-matched; if more",
      "    than one candidate matches you'll get back a 400 with the",
      "    candidate list so you can disambiguate.",
      "  - Editing a `completed` or `cancelled` ride requires",
      "    `allow_edit_finalized: true`; otherwise you'll get a 409.",
      "  - Money fields are dollars (e.g. `fare_dollars: 250.00`) and",
      "    the total is recomputed automatically.",
      "",
      "Response shape: { ride_id, before, after, changed_fields,",
      "audit_id, warnings } — use `before`/`after` to verify the edit",
      "took effect.",
    ].join("\n"),
    inputSchema: {
      type: "object",
      properties: {
        ride_id: {
          type: "string",
          description: "UUID of the ride to edit. Required.",
        },
        pickup_at: {
          type: "string",
          description:
            "ISO 8601 datetime with TZ offset (e.g. '2026-04-29T07:15:00-07:00'). Stored as UTC.",
        },
        pickup_address: { type: "string" },
        dropoff_address: { type: "string" },
        fare_dollars: { type: "number" },
        gratuity_dollars: { type: "number" },
        parking_dollars: { type: "number" },
        driver_name: {
          type: "string",
          description: "Driver name, fuzzy-matched. Ambiguous matches return a 400 with the candidate list.",
        },
        vehicle_name: {
          type: "string",
          description: "Vehicle name, fuzzy-matched. Ambiguous matches return a 400 with the candidate list.",
        },
        flight_airline: { type: "string" },
        flight_number: { type: "string" },
        flight_airport: { type: "string" },
        flight_terminal: { type: "string" },
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
        passenger_phone: { type: "string" },
        passenger_name: { type: "string" },
        notes: {
          type: "string",
          description:
            "APPENDED to the existing notes with a timestamp prefix, never overwrites.",
        },
        allow_edit_finalized: {
          type: "boolean",
          description:
            "Required true to edit a ride whose status is completed or cancelled.",
        },
      },
      required: ["ride_id"],
    },
  },
  {
    name: "update_client",
    description: [
      "Edit a recurring client's profile. Only `client_id` is required;",
      "any field you don't pass is left untouched.",
      "",
      "Special behaviors:",
      "  - `home_address`: when changed from a non-null prior value, the",
      "    old address is automatically pushed onto `previous_addresses`",
      "    (a JSON array of {address, changed_at} entries, capped at 20",
      "    entries FIFO) so we never lose",
      "    a client's address history.",
      "  - `notes` is APPENDED (timestamped), never overwrites.",
      "  - Setting `status` to 'inactive' is allowed but returns a warning.",
      "  - `default_billing` enum values: cash | card | zelle | net_15 |",
      "    net_30 | company_billing.",
      "",
      "PII redaction is automatic: phone, email, and home_address are",
      "masked in the dashboard activity feed; full values are stored in",
      "the audit table.",
      "",
      "Response shape: { client_id, before, after, changed_fields,",
      "audit_id, warnings }.",
    ].join("\n"),
    inputSchema: {
      type: "object",
      properties: {
        client_id: {
          type: "string",
          description:
            "UUID of the client to edit. Either client_id or name is required.",
        },
        name: {
          type: "string",
          description:
            "Fallback identifier — fuzzy-matched against existing clients. Ambiguous matches return 400 with the candidate list.",
        },
        phone: { type: "string" },
        email: { type: "string" },
        company: { type: "string" },
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
        home_address: {
          type: "string",
          description:
            "New primary home address. Prior non-null value is moved into previous_addresses with a timestamp.",
        },
        status: {
          type: "string",
          enum: ["active", "inactive"],
          description:
            "Setting to 'inactive' is allowed but returns a warning.",
        },
        notes: {
          type: "string",
          description:
            "APPENDED to the existing notes with a timestamp prefix, never overwrites.",
        },
      },
    },
  },
  {
    name: "link_ride_to_client",
    description: [
      "Retroactively link a ride to a recurring client when the ride was",
      "created with client_id = null. Use this to clean up orphan rides.",
      "",
      "Only the `client_id` field on the ride is updated; nothing else",
      "changes.",
      "",
      "Refuses to overwrite an existing non-null client_id unless you",
      "pass `force: true`. The 409 response includes the current",
      "client_id and name so you can confirm before re-linking.",
      "",
      "PII redaction is automatic for the activity feed; full values are",
      "stored in the audit table.",
      "",
      "Response shape: { ride_id, before, after, changed_fields,",
      "audit_id, warnings }.",
    ].join("\n"),
    inputSchema: {
      type: "object",
      properties: {
        ride_id: {
          type: "string",
          description: "UUID of the ride to link. Required.",
        },
        client_id: {
          type: "string",
          description: "UUID of the client to link the ride to. Required.",
        },
        force: {
          type: "boolean",
          description:
            "Required true to overwrite a ride that already has a non-null client_id.",
        },
      },
      required: ["ride_id", "client_id"],
    },
  },
  {
    name: "add_driver",
    description: [
      "Create a new driver record. Only `full_name` is required.",
      "",
      "Duplicate prevention: before inserting, the tool searches the",
      "drivers table for an existing record whose full_name matches",
      "case-insensitively and ignoring extra whitespace. If found, it",
      "returns 409 Conflict with the existing row attached so the caller",
      "can decide whether to use `update_driver` instead. Use this tool",
      "to register a new driver who isn't in the system yet (e.g. Carlos",
      "Garcia); use `update_driver` to modify someone who already is.",
      "",
      "Defaults: `status` falls back to 'active'. The legacy `active`",
      "boolean is kept in sync with `status` so existing driver lookups",
      "keep working.",
      "",
      "Response shape: { driver_id, driver, audit_id, warnings }.",
    ].join("\n"),
    inputSchema: {
      type: "object",
      properties: {
        full_name: {
          type: "string",
          description: "Driver's full name. Required.",
        },
        phone: { type: "string" },
        email: { type: "string" },
        default_split: {
          type: "number",
          description: "Default revenue split percentage, e.g. 70 means 70%.",
        },
        vehicle_name: {
          type: "string",
          description: "Their usual vehicle (free text, not a foreign key).",
        },
        status: {
          type: "string",
          enum: ["active", "inactive"],
          description: "Defaults to 'active'.",
        },
        notes: { type: "string" },
      },
      required: ["full_name"],
    },
  },
  {
    name: "update_driver",
    description: [
      "Edit an existing driver's profile. Either `driver_id` or",
      "`full_name` is required to identify the driver; any update field",
      "you don't pass is left untouched.",
      "",
      "Special behaviors:",
      "  - `full_name` is identifier-only; it doesn't rename the driver.",
      "  - `notes` is APPENDED (timestamped), never overwritten.",
      "  - Setting `status` to 'inactive' returns a warning and also",
      "    flips the legacy `active` boolean to false, so the driver",
      "    won't show up in driver pickers. If the driver has future",
      "    rides assigned, a second warning lists those ride IDs.",
      "",
      "PII redaction is automatic for the activity feed (phone last 4,",
      "email first letter + domain); the audit table stores full values.",
      "",
      "Response shape: { driver_id, before, after, changed_fields,",
      "audit_id, warnings }.",
    ].join("\n"),
    inputSchema: {
      type: "object",
      properties: {
        driver_id: {
          type: "string",
          description:
            "UUID of the driver to edit. Either driver_id or full_name is required.",
        },
        full_name: {
          type: "string",
          description:
            "Fallback identifier — fuzzy-matched against existing drivers. Ambiguous matches return 400 with the candidate list.",
        },
        phone: { type: "string" },
        email: { type: "string" },
        default_split: { type: "number" },
        vehicle_name: { type: "string" },
        status: {
          type: "string",
          enum: ["active", "inactive"],
          description:
            "Setting to 'inactive' is allowed but returns a warning.",
        },
        notes: {
          type: "string",
          description:
            "APPENDED to the existing notes with a timestamp prefix, never overwrites.",
        },
      },
    },
  },
  {
    name: "log_fixed_expense",
    description: [
      "Record a recurring company expense (insurance, lease, phone,",
      "software, rent, subscription). Allocates per-day to whatever",
      "window the Earnings dashboard looks at, based on cadence.",
      "",
      "Use this for amounts that arrive on a schedule. For one-time",
      "vehicle service, use `log_maintenance`. For per-ride variable",
      "costs, use `log_ride_cost`.",
      "",
      "Money is in dollars: `amount_dollars: 300.00` not cents.",
      "Cadence enum: 'weekly' | 'monthly' | 'annual' (default 'monthly').",
      "Category enum: 'insurance' | 'lease' | 'phone' | 'software' |",
      "  'rent' | 'subscription' | 'other'.",
      "",
      "Response: { expense_id, expense, warnings }.",
    ].join("\n"),
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: [
            "insurance", "lease", "phone", "software",
            "rent", "subscription", "other",
          ],
        },
        label: {
          type: "string",
          description: "Short label, e.g. 'GEICO Commercial Auto'.",
        },
        amount_dollars: {
          type: "number",
          description: "USD amount per cadence period. Must be > 0.",
        },
        cadence: {
          type: "string",
          enum: ["weekly", "monthly", "annual"],
        },
        effective_from: {
          type: "string",
          description: "YYYY-MM-DD. Defaults to today.",
        },
        effective_to: {
          type: "string",
          description: "YYYY-MM-DD when this stops applying. Null = ongoing.",
        },
        notes: { type: "string" },
      },
      required: ["category", "label", "amount_dollars"],
    },
  },
  {
    name: "log_maintenance",
    description: [
      "Record a one-time vehicle service (oil change, tires, brakes,",
      "detailing, registration, smog, repair, other).",
      "",
      "Set `service_interval_days` to amortize the cost evenly across",
      "the interval it covers (e.g. $90 oil change with 90-day interval",
      "= $1/day allocated to whatever window the dashboard looks at).",
      "Omit the interval to count the full amount once on the service",
      "date.",
      "",
      "Money is in dollars. Vehicle is fuzzy-matched by `vehicle_name`",
      "or pass `vehicle_id` directly. Ambiguous matches return 400 with",
      "the candidate list.",
      "",
      "Response: { maintenance_id, record, warnings }.",
    ].join("\n"),
    inputSchema: {
      type: "object",
      properties: {
        vehicle_name: { type: "string" },
        vehicle_id: { type: "string" },
        category: {
          type: "string",
          enum: [
            "oil", "tires", "brakes", "detailing",
            "registration", "smog", "repair", "other",
          ],
        },
        label: { type: "string" },
        amount_dollars: { type: "number" },
        serviced_at: {
          type: "string",
          description: "YYYY-MM-DD. Defaults to today.",
        },
        odometer_at_service: { type: "number" },
        service_interval_days: {
          type: "number",
          description:
            "If set, the cost amortizes over this many days. Leave null for a one-time charge.",
        },
        notes: { type: "string" },
      },
      required: ["category", "label", "amount_dollars"],
    },
  },
  {
    name: "log_ride_cost",
    description: [
      "Record a per-ride variable cost (gas, tolls, parking, amenities,",
      "tip-out, other). Use this either to set an UPFRONT ESTIMATE",
      "before the trip, or to RECORD THE ACTUAL spend after.",
      "",
      "Pass `estimated_dollars` alone to estimate. Pass `actual_dollars`",
      "to confirm the actual amount (also stamps `confirmed_at`).",
      "Passing both creates a row with both filled in.",
      "",
      "Category enum: 'gas' | 'tolls' | 'parking' | 'amenities' |",
      "  'tip_out' | 'other'.",
      "",
      "Response: { ride_cost_id, ride_cost, warnings }.",
    ].join("\n"),
    inputSchema: {
      type: "object",
      properties: {
        ride_id: { type: "string" },
        category: {
          type: "string",
          enum: ["gas", "tolls", "parking", "amenities", "tip_out", "other"],
        },
        estimated_dollars: { type: "number" },
        actual_dollars: { type: "number" },
        note: { type: "string" },
      },
      required: ["ride_id", "category"],
    },
  },
  {
    name: "list_invoices",
    description: [
      "List invoices. Capped at 50 per call (paginated via `cursor`).",
      "",
      "Filter by `status` ('open' = sent or overdue; or any of",
      "'sent' | 'paid' | 'overdue' | 'void' | 'draft' | 'all').",
      "Filter by `client_id` for a single client's history.",
      "",
      "Each row carries: id, number, amount_dollars, status,",
      "effective_status (auto-overdue when due_date passed), terms,",
      "due_date, paid_at, ride_id, days_open, days_late, client name",
      "where available.",
    ].join("\n"),
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [
            "open", "sent", "paid", "overdue", "void", "draft", "all",
          ],
        },
        client_id: { type: "string" },
        cursor: { type: "string" },
      },
    },
  },
  {
    name: "mark_invoice_paid",
    description: [
      "Mark an invoice paid. Sets status='paid' and stamps paid_at.",
      "",
      "Identify the invoice by `invoice_id` (uuid), `invoice_number`",
      "(human-readable, e.g. 'SDL-1042'), or by `ride_id` (most",
      "recent invoice on the ride). Refuses to re-pay an already-paid",
      "invoice unless `force: true`.",
      "",
      "Response: { invoice_id, before, after, warnings }.",
    ].join("\n"),
    inputSchema: {
      type: "object",
      properties: {
        invoice_id: { type: "string" },
        invoice_number: { type: "string" },
        ride_id: { type: "string" },
        paid_at: {
          type: "string",
          description: "ISO datetime. Defaults to now.",
        },
        force: { type: "boolean" },
      },
    },
  },
] as const;

type ToolName = (typeof TOOL_SCHEMAS)[number]["name"];

export type ToolContext = {
  actor: string;
};

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  env: Env,
  ctx: ToolContext,
): Promise<{
  content: { type: "text"; text: string }[];
  isError?: boolean;
}> {
  try {
    switch (name as ToolName) {
      case "create_ride":
        return ok(await createRide(args, env, ctx));
      case "list_rides":
        return ok(await listRides(args, env));
      case "update_ride_status":
        return ok(await updateRideStatus(args, env, ctx));
      case "update_ride":
        return ok(await updateRide(args, env, ctx));
      case "update_client":
        return ok(await updateClient(args, env, ctx));
      case "link_ride_to_client":
        return ok(await linkRideToClient(args, env, ctx));
      case "add_driver":
        return ok(await addDriver(args, env, ctx));
      case "update_driver":
        return ok(await updateDriver(args, env, ctx));
      case "find_or_create_client":
        return ok(await findOrCreateClient(args, env));
      case "list_drivers":
        return ok(await listDriversTool(args, env));
      case "list_vehicles":
        return ok(await listVehiclesTool(args, env));
      case "log_activity":
        return ok(await logActivity(args, env, ctx));
      case "log_fixed_expense":
        return ok(await logFixedExpense(args, env, ctx));
      case "log_maintenance":
        return ok(await logMaintenance(args, env, ctx));
      case "log_ride_cost":
        return ok(await logRideCost(args, env, ctx));
      case "list_invoices":
        return ok(await listInvoicesTool(args, env));
      case "mark_invoice_paid":
        return ok(await markInvoicePaidTool(args, env, ctx));
      default:
        return err(404, `Unknown tool: ${name}`);
    }
  } catch (e) {
    if (e instanceof ToolError) return err(e.status, e.message, e.extra);
    return err(500, e instanceof Error ? e.message : String(e));
  }
}

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});
const err = (status: number, msg: string, extra: Record<string, unknown> = {}) => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify({ error: msg, status, ...extra }, null, 2),
    },
  ],
  isError: true,
});

// ── Helpers ───────────────────────────────────────────────────────────

// All operator-facing datetime strings render in the business's timezone.
// Cloudflare Workers run in UTC, so toLocaleString() with no options would
// render UTC labelled as local — must pass timeZone explicitly.
const BUSINESS_TZ = "America/Los_Angeles";

function formatLocal(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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

// ── Pacific-day date math ────────────────────────────────────────────
//
// `pickup_at` is stored UTC. Every "day" the operator reasons about is
// a Pacific (America/Los_Angeles) calendar day: 00:00:00.000 PT through
// 23:59:59.999 PT, regardless of DST. A ride at Monday 11:30 PM PT
// belongs to Monday, not Tuesday — only the local 00:00 boundary rolls
// the day forward.
//
// Old code used `new Date(...).setHours(0,0,0,0)` after a
// toLocaleString round-trip; that builds a Date whose UTC fields look
// like Pacific wall-clock but then `setHours` mutates in the Worker's
// local zone (UTC on Cloudflare), so .toISOString() comes back at UTC
// midnight, 7-8 hours off the real Pacific midnight. Replaced below.

/** Read the wall-clock components for `d` as observed in Pacific. */
function pacificComponentsOf(d: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) =>
    parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
  // Intl sometimes reports midnight as 24 in hour12:false mode.
  let hour = get("hour");
  if (hour === 24) hour = 0;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Convert a Pacific wall-clock instant (y, mo, d, h, mi, s, ms) into the
 * UTC instant that observes it. DST-correct: derives the offset from
 * what Pacific reports for a naive guess, then adjusts. Both 00:00 and
 * 23:59:59 are unambiguous across spring-forward and fall-back (DST
 * transitions happen at 2 AM PT), so this is exact for our use.
 */
function pacificWallTimeToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  ms: number,
): Date {
  const naive = Date.UTC(y, mo - 1, d, h, mi, s, ms);
  const parts = pacificComponentsOf(new Date(naive));
  const partsAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    ms,
  );
  // `naive - partsAsUtc` is the Pacific offset at `naive` (negative).
  // Subtracting it from `naive` lands at the UTC instant whose Pacific
  // time is the input components.
  return new Date(naive + (naive - partsAsUtc));
}

/** Pacific calendar day "YYYY-MM-DD" → { from, to } as UTC ISO strings. */
function pacificDayBounds(
  ymd: string,
): { from: string; to: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  return {
    from: pacificWallTimeToUtc(y, mo, d, 0, 0, 0, 0).toISOString(),
    to: pacificWallTimeToUtc(y, mo, d, 23, 59, 59, 999).toISOString(),
  };
}

/** Today's Pacific calendar date as "YYYY-MM-DD". */
function pacificToday(now = new Date()): string {
  const p = pacificComponentsOf(now);
  return `${p.year}-${pad(p.month, 2)}-${pad(p.day, 2)}`;
}

function pad(n: number, w: number): string {
  return String(n).padStart(w, "0");
}

/** Add `days` to a "YYYY-MM-DD" string (calendar-naive, fine for our spans). */
function shiftDate(ymd: string, days: number): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  // Anchor at noon UTC to dodge DST near midnight in either direction.
  const t = new Date(Date.UTC(y, mo - 1, d, 12)).getTime();
  const t2 = new Date(t + days * 86_400_000);
  return `${t2.getUTCFullYear()}-${pad(t2.getUTCMonth() + 1, 2)}-${pad(
    t2.getUTCDate(),
    2,
  )}`;
}

/**
 * Resolve a list_rides call's date arguments into Pacific calendar
 * bounds and a UTC instant range.
 *
 *   start_date + end_date  → that span (Pacific calendar days)
 *   only start_date        → start_date through today (Pacific)
 *   only end_date          → that single day (Pacific)
 *   date keyword/literal   → today | tomorrow | this_week | next_week
 *                            | YYYY-MM-DD (all in Pacific)
 *   nothing                → today (Pacific)
 *
 * Returns null only on an unparseable input (bad YYYY-MM-DD); callers
 * can surface that as a 400.
 */
function resolveListRangeFromArgs(args: Record<string, unknown>): {
  range: { from: string; to: string };
  startYmd: string;
  endYmd: string;
  label: string;
} | null {
  const start = s(args.start_date);
  const end = s(args.end_date);
  const today = pacificToday();

  if (start || end) {
    const a = start ?? end!;
    const b = end ?? today;
    const lo = pacificDayBounds(a);
    const hi = pacificDayBounds(b);
    if (!lo || !hi) return null;
    // Allow callers to pass start > end (we just swap rather than error).
    const [startYmd, endYmd] = a <= b ? [a, b] : [b, a];
    const loB = pacificDayBounds(startYmd)!;
    const hiB = pacificDayBounds(endYmd)!;
    return {
      range: { from: loB.from, to: hiB.to },
      startYmd,
      endYmd,
      label:
        startYmd === endYmd
          ? `${startYmd} PT`
          : `${startYmd} → ${endYmd} PT`,
    };
  }

  const date = s(args.date) ?? "today";

  if (date === "today") {
    const b = pacificDayBounds(today)!;
    return { range: b, startYmd: today, endYmd: today, label: `Today (${today} PT)` };
  }
  if (date === "tomorrow") {
    const t = shiftDate(today, 1);
    const b = pacificDayBounds(t)!;
    return { range: b, startYmd: t, endYmd: t, label: `Tomorrow (${t} PT)` };
  }
  if (date === "this_week") {
    const t = shiftDate(today, 6);
    const lo = pacificDayBounds(today)!;
    const hi = pacificDayBounds(t)!;
    return {
      range: { from: lo.from, to: hi.to },
      startYmd: today,
      endYmd: t,
      label: `This week (${today} → ${t} PT)`,
    };
  }
  if (date === "next_week") {
    const a = shiftDate(today, 7);
    const b = shiftDate(today, 13);
    const lo = pacificDayBounds(a)!;
    const hi = pacificDayBounds(b)!;
    return {
      range: { from: lo.from, to: hi.to },
      startYmd: a,
      endYmd: b,
      label: `Next week (${a} → ${b} PT)`,
    };
  }

  const single = pacificDayBounds(date);
  if (!single) return null;
  return { range: single, startYmd: date, endYmd: date, label: `${date} PT` };
}

type DriverRow = { id: string; full_name: string };
type VehicleRow = { id: string; display_name: string; plate?: string | null };

// Fuzzy-match a driver name. Returns:
//   { match }                — exact (case-insensitive) match wins outright.
//   { candidates: [a, b] }   — multiple substring/word matches; caller
//                              should disambiguate.
//   { match }                — single substring/word match.
//   { match: null, ... }     — no match.
async function findDrivers(
  env: Env,
  name: string,
): Promise<{ match: DriverRow | null; candidates: DriverRow[] }> {
  const sb = adminClient(env);
  const { data } = await sb
    .from("drivers")
    .select("id, full_name")
    .eq("active", true);
  return fuzzyMatch(data ?? [], name, (d) => d.full_name);
}

async function findVehicles(
  env: Env,
  name: string,
): Promise<{ match: VehicleRow | null; candidates: VehicleRow[] }> {
  const sb = adminClient(env);
  const { data } = await sb
    .from("vehicles")
    .select("id, display_name, plate")
    .eq("active", true);
  return fuzzyMatch(data ?? [], name, (v) => v.display_name);
}

function fuzzyMatch<T>(
  rows: T[],
  query: string,
  getLabel: (row: T) => string,
): { match: T | null; candidates: T[] } {
  // Normalize both sides the same way: lower + collapse whitespace +
  // trim. So "  Greg   Vazquez  " matches "Greg Vazquez".
  const norm = normalizeName(query);
  const exact = rows.find((r) => normalizeName(getLabel(r)) === norm);
  if (exact) return { match: exact, candidates: [exact] };
  const substring = rows.filter((r) =>
    normalizeName(getLabel(r)).includes(norm),
  );
  if (substring.length === 1) return { match: substring[0], candidates: substring };
  if (substring.length > 1) return { match: null, candidates: substring };
  const word = rows.filter((r) =>
    normalizeName(getLabel(r)).split(/\W+/).includes(norm),
  );
  if (word.length === 1) return { match: word[0], candidates: word };
  if (word.length > 1) return { match: null, candidates: word };
  return { match: null, candidates: [] };
}

// Existing createRide() still uses the older "single match or null"
// convention. Adapter so we keep that behavior without re-wiring it.
async function findDriverByName(env: Env, name: string) {
  const { match } = await findDrivers(env, name);
  return match;
}
async function findVehicleByName(env: Env, name: string) {
  const { match } = await findVehicles(env, name);
  return match;
}

async function findClientByName(env: Env, name: string) {
  const { match } = await findClients(env, name);
  return match;
}

type ClientRow = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  default_billing?: string | null;
};

// Fuzzy-match a client name. Mirrors findDrivers but on the clients
// table. Normalizes input first (lower + collapse whitespace + trim)
// so "  Greg   Vazquez  " matches "Greg Vazquez".
async function findClients(
  env: Env,
  name: string,
): Promise<{ match: ClientRow | null; candidates: ClientRow[] }> {
  const sb = adminClient(env);
  const { data } = await sb
    .from("clients")
    .select("id, name, phone, email, company, default_billing");
  return fuzzyMatch(data ?? [], name, (c) => c.name);
}

// ── Tool implementations ──────────────────────────────────────────────
async function createRide(args: Record<string, unknown>, env: Env, ctx: ToolContext) {
  const sb = adminClient(env);
  const passenger_name = s(args.passenger_name);
  const pickup_at = s(args.pickup_at);
  const pickup_address = s(args.pickup_address);
  if (!passenger_name || !pickup_at || !pickup_address) {
    throw new Error(
      "passenger_name, pickup_at, and pickup_address are required.",
    );
  }
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
    if (!d)
      throw new Error(
        `Driver '${args.driver_name}' not found. Use list_drivers.`,
      );
    driver_id = d.id;
  }

  let vehicle_id: string | null = null;
  if (s(args.vehicle_name)) {
    const v = await findVehicleByName(env, s(args.vehicle_name)!);
    if (!v)
      throw new Error(
        `Vehicle '${args.vehicle_name}' not found. Use list_vehicles.`,
      );
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
    updated_by: ctx.actor,
  };

  const { data, error } = await sb
    .from("rides")
    .insert(insert)
    .select()
    .single();
  if (error) throw new Error(error.message);

  return {
    ride_id: data.id,
    summary: `Created ride for ${data.passenger_name} at ${formatLocal(
      data.pickup_at,
    )} (Pacific).`,
    ride: data,
  };
}

async function listRides(args: Record<string, unknown>, env: Env) {
  const sb = adminClient(env);
  const resolved = resolveListRangeFromArgs(args);
  if (!resolved) {
    throw new ToolError(
      400,
      "Could not parse date range. Use start_date / end_date as YYYY-MM-DD, or date as today|tomorrow|this_week|next_week|YYYY-MM-DD.",
    );
  }
  const { range, startYmd, endYmd, label } = resolved;
  const status = s(args.status);
  // Hard cap at 50; the caller's `limit` only shrinks it further. Caller
  // can paginate via `cursor`. Ignoring oversized requests prevents a
  // compromised token from dumping the whole table in one shot.
  const requested = typeof args.limit === "number" ? args.limit : MAX_PAGE;
  const limit = Math.max(1, Math.min(MAX_PAGE, requested));
  const cursor = decodeCursor(s(args.cursor));

  let q = sb.from("rides").select("*").order("pickup_at", { ascending: true });
  q = q.gte("pickup_at", range.from).lte("pickup_at", range.to);
  if (status) q = q.eq("status", status);
  if (cursor?.after_pickup_at) q = q.gt("pickup_at", cursor.after_pickup_at);
  // Fetch limit+1 to detect whether more rows exist past this page.
  q = q.limit(limit + 1);

  const { data, error } = await q;
  if (error) throw new ToolError(500, error.message);
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? encodeCursor({ after_pickup_at: page[page.length - 1].pickup_at })
    : null;

  return {
    range_label: label,
    range: {
      from: range.from,
      to: range.to,
      start_date: startYmd,
      end_date: endYmd,
      timezone: BUSINESS_TZ,
    },
    count: page.length,
    has_more: hasMore,
    next_cursor: nextCursor,
    rides: page.map((r) => ({
      id: r.id,
      pickup_at: r.pickup_at,
      pickup_at_local: formatLocal(r.pickup_at),
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

function encodeCursor(payload: Record<string, unknown>): string {
  return btoa(JSON.stringify(payload));
}
function decodeCursor(
  raw: string | undefined,
): { after_pickup_at?: string; after_id?: string } | null {
  if (!raw) return null;
  try {
    return JSON.parse(atob(raw));
  } catch {
    return null;
  }
}

async function updateRideStatus(
  args: Record<string, unknown>,
  env: Env,
  ctx: ToolContext,
) {
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
    const resolvedForLookup = date
      ? resolveListRangeFromArgs({ date })
      : null;
    const range = resolvedForLookup?.range ?? null;
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
          .map((r) => `${r.id} (${formatLocal(r.pickup_at)})`)
          .join(", ")}`,
      );
    ride_id = data[0].id;
  }

  const { data, error } = await sb
    .from("rides")
    .update({ status: new_status, updated_by: ctx.actor })
    .eq("id", ride_id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return {
    ride_id: data.id,
    new_status: data.status,
    summary: `Set ${data.passenger_name}'s ride at ${formatLocal(
      data.pickup_at,
    )} to ${data.status}.`,
  };
}

async function findOrCreateClient(args: Record<string, unknown>, env: Env) {
  const sb = adminClient(env);
  const name = s(args.name);
  if (!name) throw new Error("name is required.");

  // Lookup uses the same normalization (lower + collapse whitespace +
  // trim) as findDrivers/fuzzyMatch, so "  Greg   Vazquez  " matches
  // "Greg Vazquez".
  const { match } = await findClients(env, name);
  if (match) {
    const { data } = await sb
      .from("clients")
      .select("*")
      .eq("id", match.id)
      .single();

    // If the caller passed values that differ from the stored row,
    // surface them as warnings — do NOT silently overwrite. They
    // should re-run via update_client to commit the change.
    const warnings: string[] = [];
    const fieldsToCheck: { key: string; arg: unknown }[] = [
      { key: "phone", arg: args.phone },
      { key: "email", arg: args.email },
      { key: "company", arg: args.company },
      { key: "default_billing", arg: args.default_billing },
    ];
    for (const { key, arg } of fieldsToCheck) {
      if (arg === undefined) continue;
      const passed = s(arg) ?? null;
      const stored = (data as Record<string, unknown>)[key] ?? null;
      if (passed !== stored) {
        warnings.push(
          `Caller passed ${key}=${JSON.stringify(passed)} but stored value is ${JSON.stringify(stored)}; use update_client to change it.`,
        );
      }
    }

    return { found: true, client: data, warnings };
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
  return { found: false, created: true, client: data, warnings: [] };
}

async function listDriversTool(args: Record<string, unknown>, env: Env) {
  const sb = adminClient(env);
  const limit = clampPageSize(args.limit);
  const cursor = decodeCursor(s(args.cursor));
  let q = sb
    .from("drivers")
    .select("id, full_name, phone")
    .eq("active", true)
    .order("full_name");
  if (cursor?.after_id) q = q.gt("id", cursor.after_id);
  q = q.limit(limit + 1);
  const { data, error } = await q;
  if (error) throw new ToolError(500, error.message);
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    drivers: page,
    has_more: hasMore,
    next_cursor: hasMore
      ? encodeCursor({ after_id: page[page.length - 1].id })
      : null,
  };
}

async function listVehiclesTool(args: Record<string, unknown>, env: Env) {
  const sb = adminClient(env);
  const limit = clampPageSize(args.limit);
  const cursor = decodeCursor(s(args.cursor));
  let q = sb
    .from("vehicles")
    .select("id, display_name, plate, year, make, model")
    .eq("active", true)
    .order("display_name");
  if (cursor?.after_id) q = q.gt("id", cursor.after_id);
  q = q.limit(limit + 1);
  const { data, error } = await q;
  if (error) throw new ToolError(500, error.message);
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    vehicles: page,
    has_more: hasMore,
    next_cursor: hasMore
      ? encodeCursor({ after_id: page[page.length - 1].id })
      : null,
  };
}

function clampPageSize(raw: unknown): number {
  const n = typeof raw === "number" ? raw : MAX_PAGE;
  return Math.max(1, Math.min(MAX_PAGE, n));
}

async function logActivity(
  args: Record<string, unknown>,
  env: Env,
  ctx: ToolContext,
) {
  const sb = adminClient(env);
  const message = s(args.message);
  if (!message) throw new Error("message is required.");
  const { data, error } = await sb
    .from("events")
    .insert({
      message,
      source: s(args.source) ?? ctx.actor,
      ride_id: s(args.ride_id) ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { event_id: data.id, summary: "Logged." };
}

// ── update_ride ────────────────────────────────────────────────────────
//
// Pipeline:
//   1. Validate inputs (enums, IDs).
//   2. Load current ride.
//   3. Resolve driver/vehicle fuzzy matches (may 400 with candidates).
//   4. Build the patch — only fields the caller actually passed.
//   5. Compute changed_fields by diffing patch vs current ride.
//   6. Compose the human-readable activity message with PII redacted.
//   7. Call apply_ride_update_v1 RPC for the atomic UPDATE + audit + event.
//   8. Return before/after + audit_id + warnings.
async function updateRide(
  args: Record<string, unknown>,
  env: Env,
  ctx: ToolContext,
) {
  const sb = adminClient(env);
  const ride_id = s(args.ride_id);
  if (!ride_id) {
    throw new ToolError(400, "ride_id is required.");
  }

  // 1. enum validation up-front so we don't write half a patch then fail.
  if (args.billing_terms !== undefined) {
    const v = s(args.billing_terms);
    if (!v || !(BILLING_TERMS as readonly string[]).includes(v)) {
      throw new ToolError(400, "Invalid billing_terms.", {
        valid_values: BILLING_TERMS,
      });
    }
  }

  // pickup_at validation
  let pickupIso: string | undefined;
  if (args.pickup_at !== undefined) {
    const raw = s(args.pickup_at);
    if (!raw) throw new ToolError(400, "pickup_at, if passed, must be non-empty.");
    const t = new Date(raw);
    if (Number.isNaN(t.getTime())) {
      throw new ToolError(
        400,
        `pickup_at is not a valid ISO 8601 datetime: ${raw}`,
      );
    }
    pickupIso = t.toISOString();
  }

  // 2. Load current ride.
  const { data: current, error: loadErr } = await sb
    .from("rides")
    .select("*")
    .eq("id", ride_id)
    .maybeSingle();
  if (loadErr) throw new ToolError(500, loadErr.message);
  if (!current) {
    throw new ToolError(404, `Ride not found: ${ride_id}`);
  }

  const allowFinalized = args.allow_edit_finalized === true;
  const isFinalized =
    current.status === "completed" || current.status === "cancelled";
  if (isFinalized && !allowFinalized) {
    throw new ToolError(
      409,
      `Ride is ${current.status}. Pass allow_edit_finalized: true to edit anyway.`,
      { current_status: current.status },
    );
  }

  // 3. Resolve fuzzy matches.
  let resolvedDriverId: string | null | undefined;
  if (args.driver_name !== undefined) {
    const name = s(args.driver_name);
    if (!name) {
      throw new ToolError(400, "driver_name, if passed, must be non-empty.");
    }
    const { match, candidates } = await findDrivers(env, name);
    if (!match) {
      if (candidates.length === 0) {
        throw new ToolError(
          400,
          `No driver matches '${name}'. Use list_drivers to see options.`,
        );
      }
      throw new ToolError(400, `Multiple drivers match '${name}'.`, {
        candidates: candidates.map((d) => ({
          id: d.id,
          full_name: d.full_name,
        })),
      });
    }
    resolvedDriverId = match.id;
  }

  let resolvedVehicleId: string | null | undefined;
  if (args.vehicle_name !== undefined) {
    const name = s(args.vehicle_name);
    if (!name) {
      throw new ToolError(400, "vehicle_name, if passed, must be non-empty.");
    }
    const { match, candidates } = await findVehicles(env, name);
    if (!match) {
      if (candidates.length === 0) {
        throw new ToolError(
          400,
          `No vehicle matches '${name}'. Use list_vehicles to see options.`,
        );
      }
      throw new ToolError(400, `Multiple vehicles match '${name}'.`, {
        candidates: candidates.map((v) => ({
          id: v.id,
          display_name: v.display_name,
        })),
      });
    }
    resolvedVehicleId = match.id;
  }

  // 4. Build patch — only include fields the caller actually passed.
  const patch: Record<string, unknown> = {};
  if (pickupIso !== undefined) patch.pickup_at = pickupIso;
  if (args.pickup_address !== undefined) patch.pickup_address = s(args.pickup_address) ?? null;
  if (args.dropoff_address !== undefined) patch.dropoff_address = s(args.dropoff_address) ?? null;
  if (args.fare_dollars !== undefined) patch.fare_cents = dollarsToCents(args.fare_dollars);
  if (args.gratuity_dollars !== undefined) patch.gratuity_cents = dollarsToCents(args.gratuity_dollars);
  if (args.parking_dollars !== undefined) patch.parking_cents = dollarsToCents(args.parking_dollars);
  if (resolvedDriverId !== undefined) patch.driver_id = resolvedDriverId;
  if (resolvedVehicleId !== undefined) patch.vehicle_id = resolvedVehicleId;
  if (args.flight_airline !== undefined) patch.flight_airline = s(args.flight_airline) ?? null;
  if (args.flight_number !== undefined) patch.flight_number = s(args.flight_number) ?? null;
  if (args.flight_airport !== undefined) patch.flight_airport = s(args.flight_airport) ?? null;
  if (args.flight_terminal !== undefined) patch.flight_terminal = s(args.flight_terminal) ?? null;
  if (args.billing_terms !== undefined) patch.billing_terms = s(args.billing_terms);
  if (args.passenger_phone !== undefined) patch.passenger_phone = s(args.passenger_phone) ?? null;
  if (args.passenger_name !== undefined) patch.passenger_name = s(args.passenger_name) ?? null;

  // Notes are APPENDED — never overwritten.
  if (args.notes !== undefined) {
    const newNote = s(args.notes);
    if (newNote) {
      const stamp = noteTimestamp();
      const appended = current.notes
        ? `${current.notes}\n[${stamp}] ${newNote}`
        : `[${stamp}] ${newNote}`;
      patch.notes = appended;
    }
  }

  // 5. Compute changed_fields.
  const changed_fields: string[] = [];
  for (const field of UPDATABLE_RIDE_FIELDS) {
    if (!(field in patch)) continue;
    const before = (current as Record<string, unknown>)[field];
    const after = patch[field];
    if (!sameValue(before, after)) {
      changed_fields.push(field);
    }
  }
  // total_cents is generated; surface it in changed_fields when any input
  // money field changed (the DB will recompute on UPDATE).
  if (
    changed_fields.includes("fare_cents") ||
    changed_fields.includes("gratuity_cents") ||
    changed_fields.includes("parking_cents")
  ) {
    changed_fields.push("total_cents");
  }

  // 6. Compose warnings + human-readable PII-redacted summary.
  const warnings: string[] = [];
  if (isFinalized && allowFinalized) {
    warnings.push(
      `Edited a ${current.status} ride (allow_edit_finalized was true).`,
    );
  }

  // 7. No-op short-circuit. We still record the no-op in the activity feed?
  // The spec says "no-op is valid" and returns changed_fields: []; we do
  // NOT write an audit row for a no-op — there's nothing to record.
  if (changed_fields.length === 0) {
    return {
      ride_id,
      before: current,
      after: current,
      changed_fields: [],
      audit_id: null,
      warnings,
    };
  }

  // Build the PII-redacted human message for the activity feed. The audit
  // table gets the full unredacted snapshot via the RPC.
  const humanMessage = buildHumanMessage(current, patch, changed_fields);

  // 8. Atomic write via RPC.
  const { data: rpcData, error: rpcErr } = await sb.rpc(
    "apply_ride_update_v1",
    {
      p_ride_id: ride_id,
      p_patch: patch,
      p_changed_fields: changed_fields,
      p_actor: ctx.actor,
      p_human_message: humanMessage,
      p_allow_finalized: allowFinalized,
    },
  );
  if (rpcErr) {
    // Translate Postgres errcode signals to clean tool errors.
    if (/ride_not_found/.test(rpcErr.message)) {
      throw new ToolError(404, `Ride not found: ${ride_id}`);
    }
    if (/finalized_ride/.test(rpcErr.message)) {
      throw new ToolError(
        409,
        `Ride is ${current.status}. Pass allow_edit_finalized: true to edit anyway.`,
      );
    }
    throw new ToolError(500, rpcErr.message);
  }
  const result = rpcData as {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    audit_id: string;
  };

  return {
    ride_id,
    before: result.before,
    after: result.after,
    changed_fields,
    audit_id: result.audit_id,
    warnings,
  };
}

function sameValue(a: unknown, b: unknown): boolean {
  // Treat "" and null as equal — the worker normalizes empty strings to
  // null when building the patch, but DB rows may carry either.
  const norm = (v: unknown) => (v === "" ? null : v);
  return norm(a) === norm(b);
}

function noteTimestamp(): string {
  // "2026-05-15 14:32 PT" — matches the spec's example formatting.
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} PT`;
}

function buildHumanMessage(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
  changedFields: string[],
): string {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const field of changedFields) {
    if (field === "total_cents") continue; // implicit from money fields
    if (field === "driver_id" || field === "vehicle_id") continue; // ids aren't human-friendly
    if (!(field in patch)) continue;
    changes[field] = {
      before: (current as Record<string, unknown>)[field],
      after: patch[field],
    };
  }
  // PII fields are redacted inside summarizeRideChanges via its
  // per-field redactor table (see worker/pii.ts).
  const passenger = String(current.passenger_name ?? "ride");
  // Driver/vehicle IDs aren't reader-friendly, so just call those out.
  const extra: string[] = [];
  if (changedFields.includes("driver_id")) extra.push("driver reassigned");
  if (changedFields.includes("vehicle_id")) extra.push("vehicle reassigned");
  const base = summarizeRideChanges(passenger, changes);
  return extra.length ? `${base} (${extra.join(", ")})` : base;
}

// ── update_client ─────────────────────────────────────────────────────
//
// Mirrors update_ride's pipeline. The big special case is `home_address`:
// when it changes from a non-null prior value, the old address is
// appended to `previous_addresses` (a JSON array stored as text on the
// row) so the client's address history is never lost.
async function updateClient(
  args: Record<string, unknown>,
  env: Env,
  ctx: ToolContext,
) {
  const sb = adminClient(env);
  let client_id = s(args.client_id);
  if (!client_id) {
    // Fall back to fuzzy name resolution. Ambiguous → 400 with
    // candidates so the caller can pick one and re-run with client_id.
    const name = s(args.name);
    if (!name) {
      throw new ToolError(400, "client_id or name is required.");
    }
    const { match, candidates } = await findClients(env, name);
    if (!match) {
      if (candidates.length === 0) {
        throw new ToolError(404, `No client matches '${name}'.`);
      }
      throw new ToolError(400, `Multiple clients match '${name}'.`, {
        candidates: candidates.map((c) => ({ id: c.id, name: c.name })),
      });
    }
    client_id = match.id;
  }

  if (args.default_billing !== undefined) {
    const v = s(args.default_billing);
    if (!v || !(BILLING_TERMS as readonly string[]).includes(v)) {
      throw new ToolError(400, "Invalid default_billing.", {
        valid_values: BILLING_TERMS,
      });
    }
  }
  if (args.status !== undefined) {
    const v = s(args.status);
    if (!v || !(CLIENT_STATUSES as readonly string[]).includes(v)) {
      throw new ToolError(400, "Invalid status.", {
        valid_values: CLIENT_STATUSES,
      });
    }
  }

  const { data: current, error: loadErr } = await sb
    .from("clients")
    .select("*")
    .eq("id", client_id)
    .maybeSingle();
  if (loadErr) throw new ToolError(500, loadErr.message);
  if (!current) {
    throw new ToolError(404, `Client not found: ${client_id}`);
  }

  const patch: Record<string, unknown> = {};
  // `name` is identifier-only in this tool (Session 4); it does NOT
  // update the row. Use direct SQL for a name typo fix.
  if (args.phone !== undefined) patch.phone = s(args.phone) ?? null;
  if (args.company !== undefined) patch.company = s(args.company) ?? null;
  if (args.email !== undefined) patch.email = s(args.email) ?? null;
  if (args.default_billing !== undefined)
    patch.default_billing = s(args.default_billing);
  if (args.status !== undefined) patch.status = s(args.status);

  // The single most important behavior in this tool: never lose a
  // client's prior address. If the new home_address is different from
  // a non-null existing value, the old value is archived in
  // previous_addresses with a timestamp.
  if (args.home_address !== undefined) {
    const newAddr = s(args.home_address) ?? null;
    const oldAddr = (current as Record<string, unknown>).home_address as
      | string
      | null
      | undefined;
    if (newAddr !== (oldAddr ?? null)) {
      patch.home_address = newAddr;
      if (oldAddr) {
        let history = parseAddressHistory(
          (current as Record<string, unknown>).previous_addresses,
        );
        history.push({ address: oldAddr, changed_at: new Date().toISOString() });
        // Cap at 20 entries; FIFO-evict the oldest if we'd exceed.
        if (history.length > 20) history = history.slice(-20);
        patch.previous_addresses = JSON.stringify(history);
      }
    }
  }

  if (args.notes !== undefined) {
    const newNote = s(args.notes);
    if (newNote) {
      const stamp = noteTimestamp();
      const existing = (current as Record<string, unknown>).notes as
        | string
        | null
        | undefined;
      const appended = existing
        ? `${existing}\n[${stamp}] ${newNote}`
        : `[${stamp}] ${newNote}`;
      patch.notes = appended;
    }
  }

  const changed_fields: string[] = [];
  for (const field of UPDATABLE_CLIENT_FIELDS) {
    if (!(field in patch)) continue;
    const before = (current as Record<string, unknown>)[field];
    const after = patch[field];
    if (!sameValue(before, after)) {
      changed_fields.push(field);
    }
  }

  const warnings: string[] = [];
  if (args.status !== undefined && s(args.status) === "inactive") {
    if ((current as Record<string, unknown>).status !== "inactive") {
      warnings.push(`Client status set to inactive.`);
    }
  }

  if (changed_fields.length === 0) {
    return {
      client_id,
      before: current,
      after: current,
      changed_fields: [],
      audit_id: null,
      warnings,
    };
  }

  const humanMessage = buildClientHumanMessage(current, patch, changed_fields);

  const { data: rpcData, error: rpcErr } = await sb.rpc(
    "apply_client_update_v1",
    {
      p_client_id: client_id,
      p_patch: patch,
      p_changed_fields: changed_fields,
      p_actor: ctx.actor,
      p_human_message: humanMessage,
    },
  );
  if (rpcErr) {
    if (/client_not_found/.test(rpcErr.message)) {
      throw new ToolError(404, `Client not found: ${client_id}`);
    }
    throw new ToolError(500, rpcErr.message);
  }
  const result = rpcData as {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    audit_id: string;
  };

  return {
    client_id,
    before: result.before,
    after: result.after,
    changed_fields,
    audit_id: result.audit_id,
    warnings,
  };
}

function parseAddressHistory(
  raw: unknown,
): { address: string; changed_at: string }[] {
  if (Array.isArray(raw)) return raw as { address: string; changed_at: string }[];
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildClientHumanMessage(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
  changedFields: string[],
): string {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const field of changedFields) {
    if (field === "previous_addresses") continue; // implicit from home_address change
    if (!(field in patch)) continue;
    changes[field] = {
      before: (current as Record<string, unknown>)[field],
      after: patch[field],
    };
  }
  const name = String(current.name ?? "client");
  return summarizeChanges(`Client ${name}`, changes);
}

// ── link_ride_to_client ───────────────────────────────────────────────
//
// Retroactively sets a ride's client_id. Refuses to overwrite an
// existing non-null value unless force=true. The 409 response surfaces
// the current client info so the operator can confirm.
async function linkRideToClient(
  args: Record<string, unknown>,
  env: Env,
  ctx: ToolContext,
) {
  const sb = adminClient(env);
  const ride_id = s(args.ride_id);
  const client_id = s(args.client_id);
  if (!ride_id) throw new ToolError(400, "ride_id is required.");
  if (!client_id) throw new ToolError(400, "client_id is required.");
  const force = args.force === true;

  const { data: ride, error: rideErr } = await sb
    .from("rides")
    .select("*")
    .eq("id", ride_id)
    .maybeSingle();
  if (rideErr) throw new ToolError(500, rideErr.message);
  if (!ride) throw new ToolError(404, `Ride not found: ${ride_id}`);

  if (ride.client_id && !force) {
    const { data: existing } = await sb
      .from("clients")
      .select("id, name")
      .eq("id", ride.client_id)
      .maybeSingle();
    throw new ToolError(
      409,
      `Ride already linked to client ${existing?.name ?? ride.client_id}. Pass force: true to overwrite.`,
      {
        current: {
          id: ride.client_id,
          name: existing?.name ?? null,
        },
      },
    );
  }

  const { data: target, error: clientErr } = await sb
    .from("clients")
    .select("id, name")
    .eq("id", client_id)
    .maybeSingle();
  if (clientErr) throw new ToolError(500, clientErr.message);
  if (!target) throw new ToolError(404, `Client not found: ${client_id}`);

  // Idempotence: linking to the same client_id is a no-op.
  if (ride.client_id === client_id) {
    return {
      ride_id,
      before: ride,
      after: ride,
      changed_fields: [],
      audit_id: null,
      warnings: [],
    };
  }

  const warnings: string[] = [];
  if (force && ride.client_id) {
    warnings.push(
      `Overwrote prior client_id ${ride.client_id} (force was true).`,
    );
  }

  const passenger = String(ride.passenger_name ?? "ride");
  const targetName = String(target.name ?? client_id);
  const humanMessage = `${passenger}: linked to client ${targetName}.`;

  const { data: rpcData, error: rpcErr } = await sb.rpc(
    "apply_ride_link_client_v1",
    {
      p_ride_id: ride_id,
      p_client_id: client_id,
      p_actor: ctx.actor,
      p_human_message: humanMessage,
      p_force: force,
    },
  );
  if (rpcErr) {
    if (/ride_not_found/.test(rpcErr.message)) {
      throw new ToolError(404, `Ride not found: ${ride_id}`);
    }
    if (/client_not_found/.test(rpcErr.message)) {
      throw new ToolError(404, `Client not found: ${client_id}`);
    }
    const exMatch = /existing_client_id:([^:]+):(.*)/.exec(rpcErr.message);
    if (exMatch) {
      throw new ToolError(
        409,
        `Ride already linked to client ${exMatch[2]}. Pass force: true to overwrite.`,
        {
          current: {
            id: exMatch[1],
            name: exMatch[2] === "?" ? null : exMatch[2],
          },
        },
      );
    }
    throw new ToolError(500, rpcErr.message);
  }
  const result = rpcData as {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    audit_id: string;
  };

  return {
    ride_id,
    before: result.before,
    after: result.after,
    changed_fields: ["client_id"],
    audit_id: result.audit_id,
    warnings,
  };
}

// ── add_driver ────────────────────────────────────────────────────────
//
// Pre-check the drivers table for a case-insensitive, whitespace-
// normalized match on full_name. If a match exists, return 409 with
// the existing row attached so the caller can switch to update_driver.
// Otherwise hand off to apply_driver_create_v1 for the atomic write.
async function addDriver(
  args: Record<string, unknown>,
  env: Env,
  ctx: ToolContext,
) {
  const sb = adminClient(env);
  const full_name = s(args.full_name);
  if (!full_name) throw new ToolError(400, "full_name is required.");

  if (args.status !== undefined) {
    const v = s(args.status);
    if (!v || !(DRIVER_STATUSES as readonly string[]).includes(v)) {
      throw new ToolError(400, "Invalid status.", {
        valid_values: DRIVER_STATUSES,
      });
    }
  }

  if (args.default_split !== undefined) {
    const raw = args.default_split;
    const n = typeof raw === "number" ? raw : parseFloat(String(raw));
    if (!Number.isFinite(n)) {
      throw new ToolError(400, "default_split must be a number.");
    }
  }

  const normalized = normalizeName(full_name);

  // Duplicate check: pull all drivers (the table is small — ~3-10 rows)
  // and compare normalized names. Doing it server-side here keeps the
  // matching logic in one place and avoids ilike + collation surprises.
  const { data: existingRows, error: dupErr } = await sb
    .from("drivers")
    .select("*");
  if (dupErr) throw new ToolError(500, dupErr.message);
  const duplicate = (existingRows ?? []).find(
    (d: { full_name?: string }) =>
      typeof d.full_name === "string" &&
      normalizeName(d.full_name) === normalized,
  );
  if (duplicate) {
    throw new ToolError(
      409,
      `Driver '${full_name}' already exists. Use update_driver to modify the existing record.`,
      { existing: duplicate },
    );
  }

  const status = s(args.status) ?? "active";
  const patch: Record<string, unknown> = {
    full_name,
    status,
  };
  if (args.phone !== undefined) patch.phone = s(args.phone);
  if (args.email !== undefined) patch.email = s(args.email);
  if (args.default_split !== undefined) {
    const raw = args.default_split;
    const n = typeof raw === "number" ? raw : parseFloat(String(raw));
    patch.default_split = n;
  }
  if (args.vehicle_name !== undefined)
    patch.vehicle_name = s(args.vehicle_name);
  if (args.notes !== undefined) patch.notes = s(args.notes);

  const humanMessage = `New driver added: ${full_name}.`;

  const { data: rpcData, error: rpcErr } = await sb.rpc(
    "apply_driver_create_v1",
    {
      p_patch: patch,
      p_actor: ctx.actor,
      p_human_message: humanMessage,
    },
  );
  if (rpcErr) throw new ToolError(500, rpcErr.message);
  const result = rpcData as {
    driver: Record<string, unknown>;
    audit_id: string;
  };

  return {
    driver_id: result.driver.id,
    driver: result.driver,
    audit_id: result.audit_id,
    warnings: [],
  };
}

// Lowercase + collapse all whitespace runs (incl. tabs, NBSP) into a
// single space, trimmed. "Carlos  Garcia " and "carlos garcia" both
// fold to "carlos garcia".
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

// ── update_driver ─────────────────────────────────────────────────────
async function updateDriver(
  args: Record<string, unknown>,
  env: Env,
  ctx: ToolContext,
) {
  const sb = adminClient(env);
  let driver_id = s(args.driver_id);
  if (!driver_id) {
    // Fall back to fuzzy full_name resolution. Ambiguous → 400 with
    // candidates so the caller can pick one and re-run with driver_id.
    const name = s(args.full_name);
    if (!name) {
      throw new ToolError(400, "driver_id or full_name is required.");
    }
    const { match, candidates } = await findDrivers(env, name);
    if (!match) {
      if (candidates.length === 0) {
        throw new ToolError(404, `No driver matches '${name}'.`);
      }
      throw new ToolError(400, `Multiple drivers match '${name}'.`, {
        candidates: candidates.map((d) => ({ id: d.id, full_name: d.full_name })),
      });
    }
    driver_id = match.id;
  }

  if (args.status !== undefined) {
    const v = s(args.status);
    if (!v || !(DRIVER_STATUSES as readonly string[]).includes(v)) {
      throw new ToolError(400, "Invalid status.", {
        valid_values: DRIVER_STATUSES,
      });
    }
  }

  if (args.default_split !== undefined) {
    const raw = args.default_split;
    const n = typeof raw === "number" ? raw : parseFloat(String(raw));
    if (!Number.isFinite(n)) {
      throw new ToolError(400, "default_split must be a number.");
    }
  }

  const { data: current, error: loadErr } = await sb
    .from("drivers")
    .select("*")
    .eq("id", driver_id)
    .maybeSingle();
  if (loadErr) throw new ToolError(500, loadErr.message);
  if (!current) {
    throw new ToolError(404, `Driver not found: ${driver_id}`);
  }

  const patch: Record<string, unknown> = {};
  // `full_name` is identifier-only in this tool (Session 4); it does
  // NOT update the row. Use direct SQL for a name typo fix.
  if (args.phone !== undefined) patch.phone = s(args.phone) ?? null;
  if (args.email !== undefined) patch.email = s(args.email) ?? null;
  if (args.default_split !== undefined) {
    const raw = args.default_split;
    const n = typeof raw === "number" ? raw : parseFloat(String(raw));
    patch.default_split = n;
  }
  if (args.vehicle_name !== undefined)
    patch.vehicle_name = s(args.vehicle_name) ?? null;
  if (args.status !== undefined) patch.status = s(args.status);

  if (args.notes !== undefined) {
    const newNote = s(args.notes);
    if (newNote) {
      const stamp = noteTimestamp();
      const existing = (current as Record<string, unknown>).notes as
        | string
        | null
        | undefined;
      const appended = existing
        ? `${existing}\n[${stamp}] ${newNote}`
        : `[${stamp}] ${newNote}`;
      patch.notes = appended;
    }
  }

  const changed_fields: string[] = [];
  for (const field of UPDATABLE_DRIVER_FIELDS) {
    if (!(field in patch)) continue;
    const before = (current as Record<string, unknown>)[field];
    const after = patch[field];
    if (!sameValue(before, after)) {
      changed_fields.push(field);
    }
  }

  const warnings: string[] = [];
  const goingInactive =
    args.status !== undefined &&
    s(args.status) === "inactive" &&
    (current as Record<string, unknown>).status !== "inactive";
  if (goingInactive) {
    warnings.push(`Driver status set to inactive.`);

    // Surface any future rides still pointed at this driver so the
    // operator can reassign before the driver goes dark.
    const nowIso = new Date().toISOString();
    const { data: futureRides } = await sb
      .from("rides")
      .select("id")
      .eq("driver_id", driver_id)
      .in("status", ["scheduled", "in_progress"])
      .gte("pickup_at", nowIso);
    const ids = (futureRides ?? []).map((r: { id: string }) => r.id);
    if (ids.length > 0) {
      warnings.push(
        `Driver has ${ids.length} future ride${ids.length === 1 ? "" : "s"} assigned: ${ids.join(", ")}.`,
      );
    }
  }

  if (changed_fields.length === 0) {
    return {
      driver_id,
      before: current,
      after: current,
      changed_fields: [],
      audit_id: null,
      warnings,
    };
  }

  const humanMessage = buildDriverHumanMessage(current, patch, changed_fields);

  const { data: rpcData, error: rpcErr } = await sb.rpc(
    "apply_driver_update_v1",
    {
      p_driver_id: driver_id,
      p_patch: patch,
      p_changed_fields: changed_fields,
      p_actor: ctx.actor,
      p_human_message: humanMessage,
    },
  );
  if (rpcErr) {
    if (/driver_not_found/.test(rpcErr.message)) {
      throw new ToolError(404, `Driver not found: ${driver_id}`);
    }
    throw new ToolError(500, rpcErr.message);
  }
  const result = rpcData as {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    audit_id: string;
  };

  return {
    driver_id,
    before: result.before,
    after: result.after,
    changed_fields,
    audit_id: result.audit_id,
    warnings,
  };
}

function buildDriverHumanMessage(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
  changedFields: string[],
): string {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const field of changedFields) {
    if (!(field in patch)) continue;
    changes[field] = {
      before: (current as Record<string, unknown>)[field],
      after: patch[field],
    };
  }
  const name = String(current.full_name ?? "driver");
  return summarizeChanges(`Driver ${name}`, changes);
}

// ── log_fixed_expense ──────────────────────────────────────────────
async function logFixedExpense(
  args: Record<string, unknown>,
  env: Env,
  ctx: ToolContext,
) {
  const sb = adminClient(env);
  const category = s(args.category);
  const label = s(args.label);
  const cents = dollarsToCents(args.amount_dollars);
  const cadence = s(args.cadence) ?? "monthly";
  const effectiveFrom = s(args.effective_from) ?? todayLocalDate();
  const effectiveTo = s(args.effective_to) ?? null;
  const notes = s(args.notes) ?? null;

  if (!category) throw new ToolError(400, "category is required.");
  if (!label) throw new ToolError(400, "label is required.");
  if (!Number.isFinite(cents) || cents <= 0) {
    throw new ToolError(400, "amount_dollars must be a positive number.");
  }
  if (!["weekly", "monthly", "annual"].includes(cadence)) {
    throw new ToolError(400, `Invalid cadence: ${cadence}`);
  }
  if (
    ![
      "insurance", "lease", "phone", "software",
      "rent", "subscription", "other",
    ].includes(category)
  ) {
    throw new ToolError(400, `Invalid category: ${category}`);
  }

  const { data, error } = await sb
    .from("expenses_fixed")
    .insert({
      category,
      label,
      amount_cents: cents,
      cadence,
      effective_from: effectiveFrom,
      effective_to: effectiveTo,
      notes,
    })
    .select()
    .single();
  if (error) throw new ToolError(500, error.message);

  await sb.from("events").insert({
    source: ctx.actor,
    message: `Fixed expense added · ${label} · $${(cents / 100).toFixed(2)} ${cadence}`,
    metadata: { expense_id: data.id, category, cadence },
  });

  return { expense_id: data.id, expense: data, warnings: [] };
}

// ── log_maintenance ────────────────────────────────────────────────
async function logMaintenance(
  args: Record<string, unknown>,
  env: Env,
  ctx: ToolContext,
) {
  const sb = adminClient(env);
  const category = s(args.category);
  const label = s(args.label);
  const cents = dollarsToCents(args.amount_dollars);
  const servicedAt = s(args.serviced_at) ?? todayLocalDate();
  const notes = s(args.notes) ?? null;
  const odometer =
    typeof args.odometer_at_service === "number"
      ? Math.round(args.odometer_at_service)
      : null;
  const intervalDays =
    typeof args.service_interval_days === "number"
      ? Math.round(args.service_interval_days)
      : null;

  if (!category) throw new ToolError(400, "category is required.");
  if (!label) throw new ToolError(400, "label is required.");
  if (!Number.isFinite(cents) || cents <= 0) {
    throw new ToolError(400, "amount_dollars must be a positive number.");
  }
  if (
    ![
      "oil", "tires", "brakes", "detailing",
      "registration", "smog", "repair", "other",
    ].includes(category)
  ) {
    throw new ToolError(400, `Invalid category: ${category}`);
  }
  if (intervalDays !== null && intervalDays <= 0) {
    throw new ToolError(
      400,
      "service_interval_days must be > 0 when set.",
    );
  }

  let vehicleId = s(args.vehicle_id) ?? null;
  if (!vehicleId) {
    const vehicleName = s(args.vehicle_name);
    if (!vehicleName) {
      throw new ToolError(400, "vehicle_id or vehicle_name is required.");
    }
    const lookup = await findVehicles(env, vehicleName);
    if (!lookup.match && lookup.candidates.length === 0) {
      throw new ToolError(404, `No vehicle matched "${vehicleName}".`);
    }
    if (!lookup.match && lookup.candidates.length > 1) {
      throw new ToolError(400, "Ambiguous vehicle match.", {
        candidates: lookup.candidates.map((v) => ({
          id: v.id,
          display_name: v.display_name,
        })),
      });
    }
    vehicleId = lookup.match!.id;
  }

  const { data, error } = await sb
    .from("vehicle_maintenance")
    .insert({
      vehicle_id: vehicleId,
      category,
      label,
      amount_cents: cents,
      serviced_at: servicedAt,
      odometer_at_service: odometer,
      service_interval_days: intervalDays,
      notes,
    })
    .select()
    .single();
  if (error) throw new ToolError(500, error.message);

  await sb.from("events").insert({
    source: ctx.actor,
    message: `Maintenance logged · ${label} · $${(cents / 100).toFixed(2)}`,
    metadata: {
      maintenance_id: data.id,
      vehicle_id: vehicleId,
      category,
    },
  });

  return { maintenance_id: data.id, record: data, warnings: [] };
}

// ── log_ride_cost ──────────────────────────────────────────────────
async function logRideCost(
  args: Record<string, unknown>,
  env: Env,
  ctx: ToolContext,
) {
  const sb = adminClient(env);
  const rideId = s(args.ride_id);
  const category = s(args.category);
  if (!rideId) throw new ToolError(400, "ride_id is required.");
  if (!category) throw new ToolError(400, "category is required.");
  if (
    !["gas", "tolls", "parking", "amenities", "tip_out", "other"].includes(
      category,
    )
  ) {
    throw new ToolError(400, `Invalid category: ${category}`);
  }

  const hasEstimated = args.estimated_dollars !== undefined;
  const hasActual = args.actual_dollars !== undefined;
  if (!hasEstimated && !hasActual) {
    throw new ToolError(
      400,
      "Provide estimated_dollars, actual_dollars, or both.",
    );
  }
  const estCents = hasEstimated
    ? dollarsToCents(args.estimated_dollars)
    : 0;
  const actCents = hasActual ? dollarsToCents(args.actual_dollars) : null;
  if (estCents < 0 || (actCents !== null && actCents < 0)) {
    throw new ToolError(400, "Costs cannot be negative.");
  }

  // Make sure the ride exists — gives a clean 404 instead of a generic
  // FK violation message.
  const { data: ride, error: rideErr } = await sb
    .from("rides")
    .select("id, passenger_name")
    .eq("id", rideId)
    .maybeSingle();
  if (rideErr) throw new ToolError(500, rideErr.message);
  if (!ride) throw new ToolError(404, `Ride ${rideId} not found.`);

  const { data, error } = await sb
    .from("ride_costs")
    .insert({
      ride_id: rideId,
      category,
      estimated_cents: estCents,
      actual_cents: actCents,
      confirmed_at: actCents !== null ? new Date().toISOString() : null,
      note: s(args.note) ?? null,
    })
    .select()
    .single();
  if (error) throw new ToolError(500, error.message);

  const dollarsLabel =
    actCents !== null
      ? `actual $${(actCents / 100).toFixed(2)}`
      : `est. $${(estCents / 100).toFixed(2)}`;
  await sb.from("events").insert({
    source: ctx.actor,
    ride_id: rideId,
    message: `Ride cost · ${category} · ${dollarsLabel}`,
    metadata: { ride_cost_id: data.id, category },
  });

  return { ride_cost_id: data.id, ride_cost: data, warnings: [] };
}

// ── list_invoices ──────────────────────────────────────────────────
async function listInvoicesTool(
  args: Record<string, unknown>,
  env: Env,
) {
  const sb = adminClient(env);
  const filter = s(args.status) ?? "open";
  const clientId = s(args.client_id);
  const cursor = s(args.cursor);
  const today = todayLocalDate();

  let q = sb
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(MAX_PAGE + 1);
  if (cursor) q = q.lt("created_at", cursor);

  const { data: rows, error } = await q;
  if (error) throw new ToolError(500, error.message);

  // Pull rides + clients to enrich for the response (one bulk query each).
  const rideIds = Array.from(
    new Set((rows ?? []).map((r) => r.ride_id).filter((x) => x)),
  );
  let rideMap = new Map<
    string,
    { id: string; client_id: string | null; passenger_name: string; pickup_at: string }
  >();
  if (rideIds.length > 0) {
    const { data: rs, error: rErr } = await sb
      .from("rides")
      .select("id, client_id, passenger_name, pickup_at")
      .in("id", rideIds);
    if (rErr) throw new ToolError(500, rErr.message);
    rideMap = new Map((rs ?? []).map((r) => [r.id, r]));
  }
  const clientIds = Array.from(
    new Set(
      Array.from(rideMap.values())
        .map((r) => r.client_id)
        .filter((x): x is string => !!x),
    ),
  );
  let clientMap = new Map<
    string,
    { id: string; name: string; company: string | null }
  >();
  if (clientIds.length > 0) {
    const { data: cs, error: cErr } = await sb
      .from("clients")
      .select("id, name, company")
      .in("id", clientIds);
    if (cErr) throw new ToolError(500, cErr.message);
    clientMap = new Map((cs ?? []).map((c) => [c.id, c]));
  }

  type Enriched = {
    id: string;
    number: string | null;
    amount_dollars: number;
    status: string;
    effective_status: string;
    terms: string | null;
    due_date: string | null;
    paid_at: string | null;
    ride_id: string | null;
    days_open: number;
    days_late: number;
    client_id: string | null;
    client_name: string | null;
    client_company: string | null;
    passenger_name: string | null;
    pickup_at: string | null;
    created_at: string;
  };
  const enriched: Enriched[] = (rows ?? []).map((inv) => {
    const ride = inv.ride_id ? rideMap.get(inv.ride_id) : null;
    const client =
      ride?.client_id ? clientMap.get(ride.client_id) ?? null : null;
    const overdue =
      inv.status === "sent" && inv.due_date && inv.due_date < today;
    const daysOpen = Math.max(
      0,
      Math.round(
        (Date.now() - new Date(inv.created_at).getTime()) / 86_400_000,
      ),
    );
    const daysLate =
      inv.due_date && inv.due_date < today
        ? Math.round(
            (Date.now() -
              new Date(inv.due_date + "T23:59:59Z").getTime()) /
              86_400_000,
          )
        : 0;
    return {
      id: inv.id,
      number: inv.number,
      amount_dollars: inv.amount_cents / 100,
      status: inv.status,
      effective_status: overdue ? "overdue" : inv.status,
      terms: inv.terms,
      due_date: inv.due_date,
      paid_at: inv.paid_at,
      ride_id: inv.ride_id,
      days_open: daysOpen,
      days_late: daysLate,
      client_id: ride?.client_id ?? null,
      client_name: client?.name ?? null,
      client_company: client?.company ?? null,
      passenger_name: ride?.passenger_name ?? null,
      pickup_at: ride?.pickup_at ?? null,
      created_at: inv.created_at,
    };
  });

  // Apply filters in-memory (the table is small enough; cleaner than
  // synthesizing the filter at the SQL layer for "open" which spans
  // two statuses + due-date).
  let filtered = enriched;
  if (clientId) {
    filtered = filtered.filter((e) => e.client_id === clientId);
  }
  if (filter === "open") {
    filtered = filtered.filter(
      (e) =>
        e.effective_status === "sent" || e.effective_status === "overdue",
    );
  } else if (filter !== "all") {
    filtered = filtered.filter((e) => e.effective_status === filter);
  }

  const hasMore = filtered.length > MAX_PAGE;
  const page = filtered.slice(0, MAX_PAGE);
  const nextCursor = hasMore ? page[page.length - 1].created_at : null;
  const totalDollars = page.reduce((s, e) => s + e.amount_dollars, 0);

  return {
    invoices: page,
    count: page.length,
    total_dollars: Math.round(totalDollars * 100) / 100,
    has_more: hasMore,
    next_cursor: nextCursor,
  };
}

// ── mark_invoice_paid ──────────────────────────────────────────────
async function markInvoicePaidTool(
  args: Record<string, unknown>,
  env: Env,
  ctx: ToolContext,
) {
  const sb = adminClient(env);
  const invoiceId = s(args.invoice_id);
  const invoiceNumber = s(args.invoice_number);
  const rideId = s(args.ride_id);
  const force = args.force === true;
  const paidAt = s(args.paid_at) ?? new Date().toISOString();

  if (!invoiceId && !invoiceNumber && !rideId) {
    throw new ToolError(
      400,
      "Provide invoice_id, invoice_number, or ride_id.",
    );
  }

  // Resolve to a single invoice row.
  let q = sb.from("invoices").select("*").limit(2);
  if (invoiceId) q = q.eq("id", invoiceId);
  else if (invoiceNumber) q = q.eq("number", invoiceNumber);
  else if (rideId) {
    q = q.eq("ride_id", rideId).order("created_at", { ascending: false });
  }
  const { data: rows, error: fetchErr } = await q;
  if (fetchErr) throw new ToolError(500, fetchErr.message);
  if (!rows || rows.length === 0) {
    throw new ToolError(404, "Invoice not found.");
  }
  if (rows.length > 1 && !invoiceId && !invoiceNumber) {
    throw new ToolError(409, "Multiple invoices match — pass invoice_id.", {
      candidates: rows.map((r) => ({
        id: r.id,
        number: r.number,
        status: r.status,
        amount_cents: r.amount_cents,
      })),
    });
  }
  // Deep-copy so the `before` snapshot doesn't get mutated when the
  // update lands. Real Postgres returns distinct objects; some test
  // fakes (and even some PostgREST quirks) share references.
  const before = { ...rows[0] };

  if (before.status === "paid" && !force) {
    throw new ToolError(409, "Invoice is already paid. Pass force=true to override.", {
      paid_at: before.paid_at,
    });
  }
  if (before.status === "void" && !force) {
    throw new ToolError(409, "Invoice is voided. Pass force=true to override.");
  }

  const { data: after, error } = await sb
    .from("invoices")
    .update({ status: "paid", paid_at: paidAt })
    .eq("id", before.id)
    .select()
    .single();
  if (error) throw new ToolError(500, error.message);

  await sb.from("events").insert({
    source: ctx.actor,
    ride_id: before.ride_id ?? null,
    message: `Invoice ${before.number ?? before.id.slice(0, 8)} marked paid · $${(before.amount_cents / 100).toFixed(2)}`,
    metadata: {
      invoice_id: before.id,
      invoice_number: before.number,
    },
  });

  return {
    invoice_id: before.id,
    before,
    after,
    warnings: force && before.status === "paid"
      ? ["Was already paid; forcibly re-stamped."]
      : [],
  };
}

// Helper: today as YYYY-MM-DD in business timezone.
function todayLocalDate(): string {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: BUSINESS_TZ });
}
