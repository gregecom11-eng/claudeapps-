// update_ride test suite. Run with `npm test`.
//
// We stub the Supabase client and the rate-limit RPC at the
// `./supabase` module so the tool code under test is otherwise
// unmodified. Each test sets up an in-memory "DB" of rides / drivers /
// vehicles and asserts on the recorded writes + tool output.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Single shared fake DB — reset in beforeEach.
type FakeDB = {
  rides: Record<string, any>;
  clients: Record<string, any>;
  drivers: any[];
  vehicles: any[];
  audit: any[];
  events: any[];
  expenses_fixed: any[];
  vehicle_maintenance: any[];
  ride_costs: any[];
  invoices: any[];
  rate_limits: { actor: string; minute_bucket: string; count: number }[];
};
let db: FakeDB;

function newDB(): FakeDB {
  return {
    rides: {},
    clients: {},
    drivers: [],
    vehicles: [],
    audit: [],
    events: [],
    expenses_fixed: [],
    vehicle_maintenance: [],
    ride_costs: [],
    invoices: [],
    rate_limits: [],
  };
}

// Minimal Supabase query-builder fake. Only supports the call shapes the
// tools actually use. Reads/writes the in-memory `db`.
function fakeSupabase() {
  return {
    from(table: string) {
      let _filters: ((row: any) => boolean)[] = [];
      let _order: { col: string; asc: boolean } | null = null;
      let _limit: number | null = null;
      let _isUpdate = false;
      let _updatePatch: Record<string, any> | null = null;
      let _isInsert = false;
      let _insertValues: any = null;
      let _wantSingle = false;
      let _wantMaybeSingle = false;

      const exec = async (): Promise<{ data: any; error: any }> => {
        let rows: any[];
        if (table === "rides") rows = Object.values(db.rides);
        else if (table === "clients") rows = Object.values(db.clients);
        else if (table === "drivers") rows = db.drivers;
        else if (table === "vehicles") rows = db.vehicles;
        else if (table === "events") rows = db.events;
        else if (table === "audit") rows = db.audit;
        else if (table === "expenses_fixed") rows = db.expenses_fixed;
        else if (table === "vehicle_maintenance")
          rows = db.vehicle_maintenance;
        else if (table === "ride_costs") rows = db.ride_costs;
        else if (table === "invoices") rows = db.invoices;
        else rows = [];
        rows = rows.filter((r) => _filters.every((f) => f(r)));
        if (_order) {
          rows = [...rows].sort((a, b) => {
            const x = a[_order!.col];
            const y = b[_order!.col];
            return _order!.asc ? (x > y ? 1 : x < y ? -1 : 0) : (x < y ? 1 : x > y ? -1 : 0);
          });
        }
        if (_limit !== null) rows = rows.slice(0, _limit);

        if (_isInsert) {
          const arr = Array.isArray(_insertValues) ? _insertValues : [_insertValues];
          const inserted: any[] = [];
          for (const v of arr) {
            const row = { id: cryptoRandom(), ...v };
            if (table === "rides") db.rides[row.id] = row;
            else if (table === "clients") db.clients[row.id] = row;
            else if (table === "events") db.events.push(row);
            else if (table === "audit") db.audit.push(row);
            else if (table === "drivers") db.drivers.push(row);
            else if (table === "vehicles") db.vehicles.push(row);
            else if (table === "expenses_fixed") db.expenses_fixed.push(row);
            else if (table === "vehicle_maintenance")
              db.vehicle_maintenance.push(row);
            else if (table === "ride_costs") db.ride_costs.push(row);
            else if (table === "invoices") db.invoices.push(row);
            inserted.push(row);
          }
          const data = _wantSingle || _wantMaybeSingle ? inserted[0] : inserted;
          return { data, error: null };
        }
        if (_isUpdate) {
          const updated: any[] = [];
          for (const r of rows) {
            Object.assign(r, _updatePatch);
            updated.push(r);
          }
          const data = _wantSingle || _wantMaybeSingle ? updated[0] : updated;
          return { data, error: null };
        }
        const data = _wantSingle ? rows[0] : _wantMaybeSingle ? rows[0] ?? null : rows;
        return { data, error: null };
      };

      const builder: any = {
        select(_sel?: string) {
          return builder;
        },
        eq(col: string, val: any) {
          _filters.push((r) => r[col] === val);
          return builder;
        },
        gt(col: string, val: any) {
          _filters.push((r) => r[col] > val);
          return builder;
        },
        gte(col: string, val: any) {
          _filters.push((r) => r[col] >= val);
          return builder;
        },
        lte(col: string, val: any) {
          _filters.push((r) => r[col] <= val);
          return builder;
        },
        in(col: string, vals: any[]) {
          _filters.push((r) => vals.includes(r[col]));
          return builder;
        },
        ilike(col: string, pat: string) {
          const re = new RegExp(pat.replace(/%/g, ".*"), "i");
          _filters.push((r) => re.test(String(r[col] ?? "")));
          return builder;
        },
        order(col: string, opts?: { ascending?: boolean }) {
          _order = { col, asc: opts?.ascending !== false };
          return builder;
        },
        limit(n: number) {
          _limit = n;
          return builder;
        },
        insert(v: any) {
          _isInsert = true;
          _insertValues = v;
          return builder;
        },
        update(p: any) {
          _isUpdate = true;
          _updatePatch = p;
          return builder;
        },
        single() {
          _wantSingle = true;
          return exec();
        },
        maybeSingle() {
          _wantMaybeSingle = true;
          return exec();
        },
        then(resolve: any, reject: any) {
          return exec().then(resolve, reject);
        },
      };
      return builder;
    },

    async rpc(name: string, args: any) {
      if (name === "check_and_increment_rate_limit") {
        const actor = args.p_actor;
        const minute = Math.floor(Date.now() / 60000);
        const bucketKey = `${actor}:${minute}`;
        let bucket = db.rate_limits.find(
          (b) => b.actor === actor && b.minute_bucket === bucketKey,
        );
        if (!bucket) {
          bucket = { actor, minute_bucket: bucketKey, count: 0 };
          db.rate_limits.push(bucket);
        }
        bucket.count += 1;
        const minute_count = bucket.count;
        const hour_count = db.rate_limits
          .filter((b) => b.actor === actor)
          .reduce((a, b) => a + b.count, 0);
        if (minute_count > 100) {
          return {
            data: [
              {
                allowed: false,
                reason: "per-minute limit exceeded",
                minute_count,
                hour_count,
                retry_after_seconds: 30,
              },
            ],
            error: null,
          };
        }
        return {
          data: [
            { allowed: true, reason: null, minute_count, hour_count, retry_after_seconds: 0 },
          ],
          error: null,
        };
      }
      if (name === "apply_ride_update_v1") {
        const ride = db.rides[args.p_ride_id];
        if (!ride) {
          return { data: null, error: { message: "ride_not_found" } };
        }
        if (
          (ride.status === "completed" || ride.status === "cancelled") &&
          !args.p_allow_finalized
        ) {
          return { data: null, error: { message: "finalized_ride" } };
        }
        const before = { ...ride };
        for (const [k, v] of Object.entries(args.p_patch ?? {})) {
          ride[k] = v;
        }
        ride.fare_cents = ride.fare_cents ?? 0;
        ride.gratuity_cents = ride.gratuity_cents ?? 0;
        ride.parking_cents = ride.parking_cents ?? 0;
        ride.total_cents =
          (ride.fare_cents || 0) + (ride.gratuity_cents || 0) + (ride.parking_cents || 0);
        ride.updated_by = args.p_actor;
        ride.updated_at = new Date().toISOString();
        const after = { ...ride };
        const auditRow = {
          id: cryptoRandom(),
          entity_type: "ride",
          entity_id: args.p_ride_id,
          action: "update",
          changed_fields: JSON.stringify(args.p_changed_fields),
          before_json: JSON.stringify(before),
          after_json: JSON.stringify(after),
          actor: args.p_actor,
          created_at: new Date().toISOString(),
        };
        db.audit.push(auditRow);
        if (args.p_human_message) {
          db.events.push({
            id: cryptoRandom(),
            ride_id: args.p_ride_id,
            source: args.p_actor,
            message: args.p_human_message,
            metadata: {
              audit_id: auditRow.id,
              changed_fields: args.p_changed_fields,
            },
            created_at: new Date().toISOString(),
          });
        }
        return {
          data: { before, after, audit_id: auditRow.id },
          error: null,
        };
      }
      if (name === "apply_client_update_v1") {
        const client = db.clients[args.p_client_id];
        if (!client) {
          return { data: null, error: { message: "client_not_found" } };
        }
        const before = { ...client };
        for (const [k, v] of Object.entries(args.p_patch ?? {})) {
          client[k] = v;
        }
        client.updated_at = new Date().toISOString();
        const after = { ...client };
        const auditRow = {
          id: cryptoRandom(),
          entity_type: "client",
          entity_id: args.p_client_id,
          action: "update",
          changed_fields: JSON.stringify(args.p_changed_fields),
          before_json: JSON.stringify(before),
          after_json: JSON.stringify(after),
          actor: args.p_actor,
          created_at: new Date().toISOString(),
        };
        db.audit.push(auditRow);
        if (args.p_human_message) {
          db.events.push({
            id: cryptoRandom(),
            ride_id: null,
            source: args.p_actor,
            message: args.p_human_message,
            metadata: {
              audit_id: auditRow.id,
              entity_type: "client",
              entity_id: args.p_client_id,
              changed_fields: args.p_changed_fields,
            },
            created_at: new Date().toISOString(),
          });
        }
        return {
          data: { before, after, audit_id: auditRow.id },
          error: null,
        };
      }
      if (name === "apply_ride_link_client_v1") {
        const ride = db.rides[args.p_ride_id];
        if (!ride) {
          return { data: null, error: { message: "ride_not_found" } };
        }
        if (ride.client_id && !args.p_force) {
          const existing = db.clients[ride.client_id];
          return {
            data: null,
            error: {
              message: `existing_client_id:${ride.client_id}:${existing?.name ?? "?"}`,
            },
          };
        }
        const target = db.clients[args.p_client_id];
        if (!target) {
          return { data: null, error: { message: "client_not_found" } };
        }
        const before = { ...ride };
        ride.client_id = args.p_client_id;
        ride.updated_by = args.p_actor;
        ride.updated_at = new Date().toISOString();
        const after = { ...ride };
        const auditRow = {
          id: cryptoRandom(),
          entity_type: "ride",
          entity_id: args.p_ride_id,
          action: "link",
          changed_fields: JSON.stringify(["client_id"]),
          before_json: JSON.stringify(before),
          after_json: JSON.stringify(after),
          actor: args.p_actor,
          created_at: new Date().toISOString(),
        };
        db.audit.push(auditRow);
        if (args.p_human_message) {
          db.events.push({
            id: cryptoRandom(),
            ride_id: args.p_ride_id,
            source: args.p_actor,
            message: args.p_human_message,
            metadata: {
              audit_id: auditRow.id,
              changed_fields: ["client_id"],
              force: args.p_force === true,
            },
            created_at: new Date().toISOString(),
          });
        }
        return {
          data: { before, after, audit_id: auditRow.id },
          error: null,
        };
      }
      if (name === "apply_driver_create_v1") {
        const patch = args.p_patch ?? {};
        const status = patch.status ?? "active";
        const row = {
          id: cryptoRandom(),
          full_name: patch.full_name,
          phone: patch.phone ?? null,
          email: patch.email ?? null,
          default_split: patch.default_split ?? null,
          vehicle_name: patch.vehicle_name ?? null,
          status,
          notes: patch.notes ?? null,
          active: status === "active",
          created_at: new Date().toISOString(),
        };
        db.drivers.push(row);
        const auditRow = {
          id: cryptoRandom(),
          entity_type: "driver",
          entity_id: row.id,
          action: "create",
          changed_fields: JSON.stringify([
            "full_name",
            "phone",
            "email",
            "default_split",
            "vehicle_name",
            "status",
            "notes",
          ]),
          before_json: null,
          after_json: JSON.stringify(row),
          actor: args.p_actor,
          created_at: new Date().toISOString(),
        };
        db.audit.push(auditRow);
        if (args.p_human_message) {
          db.events.push({
            id: cryptoRandom(),
            ride_id: null,
            source: args.p_actor,
            message: args.p_human_message,
            metadata: {
              audit_id: auditRow.id,
              entity_type: "driver",
              entity_id: row.id,
              action: "create",
            },
            created_at: new Date().toISOString(),
          });
        }
        return { data: { driver: row, audit_id: auditRow.id }, error: null };
      }
      if (name === "apply_driver_update_v1") {
        const driver = db.drivers.find((d) => d.id === args.p_driver_id);
        if (!driver) {
          return { data: null, error: { message: "driver_not_found" } };
        }
        const before = { ...driver };
        for (const [k, v] of Object.entries(args.p_patch ?? {})) {
          driver[k] = v;
        }
        // Mirror the SQL: when status is in the patch, sync `active`.
        if (args.p_patch && "status" in args.p_patch) {
          driver.active = args.p_patch.status === "active";
        }
        const after = { ...driver };
        const auditRow = {
          id: cryptoRandom(),
          entity_type: "driver",
          entity_id: args.p_driver_id,
          action: "update",
          changed_fields: JSON.stringify(args.p_changed_fields),
          before_json: JSON.stringify(before),
          after_json: JSON.stringify(after),
          actor: args.p_actor,
          created_at: new Date().toISOString(),
        };
        db.audit.push(auditRow);
        if (args.p_human_message) {
          db.events.push({
            id: cryptoRandom(),
            ride_id: null,
            source: args.p_actor,
            message: args.p_human_message,
            metadata: {
              audit_id: auditRow.id,
              entity_type: "driver",
              entity_id: args.p_driver_id,
              changed_fields: args.p_changed_fields,
            },
            created_at: new Date().toISOString(),
          });
        }
        return {
          data: { before, after, audit_id: auditRow.id },
          error: null,
        };
      }
      return { data: null, error: { message: `unmocked rpc: ${name}` } };
    },
  };
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

// Stub the `./supabase` module so adminClient returns our fake. Has to
// be set up BEFORE the tools module is imported.
vi.mock("./supabase", () => ({
  adminClient: () => fakeSupabase(),
}));

// Helpers — load fresh tools module after the mock is registered.
async function loadTools() {
  return await import("./tools");
}

const fakeEnv = {
  ASSETS: {} as any,
  SUPABASE_URL: "x",
  SUPABASE_SERVICE_ROLE_KEY: "x",
  MCP_API_KEY: "test-token",
};
const fakeCtx = { actor: "mcp:claude" };

function makeRide(overrides: Partial<any> = {}) {
  const id = cryptoRandom();
  const row = {
    id,
    status: "scheduled",
    source: "manual",
    passenger_name: "Greg Vazquez",
    passenger_phone: "+1 (619) 555-1086",
    pickup_at: "2026-05-20T15:30:00.000Z",
    pickup_address: "11125 Sands Ave, Newport Beach, CA 92660",
    dropoff_address: "SAN Airport, San Diego, CA 92101",
    fare_cents: 20000,
    gratuity_cents: 0,
    parking_cents: 0,
    total_cents: 20000,
    billing_terms: "card",
    notes: "Existing note from earlier.",
    driver_id: null,
    vehicle_id: null,
    flight_airline: null,
    flight_number: null,
    flight_airport: null,
    flight_terminal: null,
    updated_by: null,
    updated_at: "2026-05-15T00:00:00.000Z",
    created_at: "2026-05-15T00:00:00.000Z",
    ...overrides,
  };
  db.rides[id] = row;
  return row;
}

function makeClient(overrides: Partial<any> = {}) {
  const id = cryptoRandom();
  const row = {
    id,
    name: "Greg Vazquez",
    company: null,
    email: "greg@example.com",
    phone: "+1 (619) 555-1086",
    default_billing: "card",
    home_address: null,
    previous_addresses: "[]",
    status: "active",
    notes: null,
    preferences: {},
    created_at: "2026-05-15T00:00:00.000Z",
    updated_at: "2026-05-15T00:00:00.000Z",
    ...overrides,
  };
  db.clients[id] = row;
  return row;
}

function makeDriver(overrides: Partial<any> = {}) {
  const id = cryptoRandom();
  const row = {
    id,
    full_name: "Hassan",
    phone: null,
    email: null,
    default_split: null,
    vehicle_name: null,
    status: "active",
    notes: null,
    active: true,
    created_at: "2026-05-15T00:00:00.000Z",
    ...overrides,
  };
  db.drivers.push(row);
  return row;
}

function parseResult(result: { content: { text: string }[]; isError?: boolean }) {
  return JSON.parse(result.content[0].text);
}

beforeEach(() => {
  db = newDB();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────────────
// Test cases
// ────────────────────────────────────────────────────────────────────

describe("update_ride", () => {
  it("1. happy path — pickup_at + fare_dollars", async () => {
    const { executeTool } = await loadTools();
    const ride = makeRide();

    const res = await executeTool(
      "update_ride",
      {
        ride_id: ride.id,
        pickup_at: "2026-05-20T17:30:00-07:00",
        fare_dollars: 250,
      },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.ride_id).toBe(ride.id);
    expect(body.before.fare_cents).toBe(20000);
    expect(body.after.fare_cents).toBe(25000);
    expect(body.after.total_cents).toBe(25000);
    expect(body.changed_fields).toContain("pickup_at");
    expect(body.changed_fields).toContain("fare_cents");
    expect(body.changed_fields).toContain("total_cents");
    expect(body.audit_id).toBeTruthy();

    // Audit row written.
    expect(db.audit).toHaveLength(1);
    expect(db.audit[0].actor).toBe("mcp:claude");
    expect(db.audit[0].entity_type).toBe("ride");

    // Activity event written.
    expect(db.events).toHaveLength(1);
    const msg = db.events[0].message as string;
    expect(msg).toContain("Greg Vazquez");
    expect(msg).toContain("$250.00");
  });

  it("2. no-op — only ride_id, changed_fields is []", async () => {
    const { executeTool } = await loadTools();
    const ride = makeRide();
    const res = await executeTool(
      "update_ride",
      { ride_id: ride.id },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.changed_fields).toEqual([]);
    expect(body.audit_id).toBeNull();
    expect(db.audit).toHaveLength(0);
    expect(db.events).toHaveLength(0);
  });

  it("3. not found — bad UUID returns 404", async () => {
    const { executeTool } = await loadTools();
    const res = await executeTool(
      "update_ride",
      { ride_id: "00000000-0000-0000-0000-000000000000" },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBe(true);
    const body = parseResult(res);
    expect(body.status).toBe(404);
    expect(body.error).toContain("not found");
  });

  it("4. invalid enum — bad billing_terms returns 400 with valid values", async () => {
    const { executeTool } = await loadTools();
    const ride = makeRide();
    const res = await executeTool(
      "update_ride",
      { ride_id: ride.id, billing_terms: "bitcoin" },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBe(true);
    const body = parseResult(res);
    expect(body.status).toBe(400);
    expect(body.valid_values).toContain("cash");
    expect(body.valid_values).toContain("company_billing");
  });

  it("5. ambiguous driver match — multiple matches → 400 with candidate list", async () => {
    const { executeTool } = await loadTools();
    const ride = makeRide();
    db.drivers.push(
      { id: "d1", full_name: "David Santiago", active: true },
      { id: "d2", full_name: "David Garcia", active: true },
    );
    const res = await executeTool(
      "update_ride",
      { ride_id: ride.id, driver_name: "David" },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBe(true);
    const body = parseResult(res);
    expect(body.status).toBe(400);
    expect(body.candidates).toHaveLength(2);
    expect(body.candidates.map((c: any) => c.full_name).sort()).toEqual([
      "David Garcia",
      "David Santiago",
    ]);
  });

  it("6. finalized ride without flag → 409", async () => {
    const { executeTool } = await loadTools();
    const ride = makeRide({ status: "completed" });
    const res = await executeTool(
      "update_ride",
      { ride_id: ride.id, fare_dollars: 300 },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBe(true);
    const body = parseResult(res);
    expect(body.status).toBe(409);
    expect(body.current_status).toBe("completed");
    expect(body.error).toContain("allow_edit_finalized");
  });

  it("7. finalized ride WITH allow_edit_finalized — succeeds with warning", async () => {
    const { executeTool } = await loadTools();
    const ride = makeRide({ status: "completed" });
    const res = await executeTool(
      "update_ride",
      {
        ride_id: ride.id,
        fare_dollars: 300,
        allow_edit_finalized: true,
      },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.after.fare_cents).toBe(30000);
    expect(body.warnings.length).toBeGreaterThanOrEqual(1);
    expect(body.warnings[0]).toContain("completed");
  });

  it("8. notes append — existing notes preserved, new note timestamped", async () => {
    const { executeTool } = await loadTools();
    const ride = makeRide({ notes: "Existing note from earlier." });
    const res = await executeTool(
      "update_ride",
      { ride_id: ride.id, notes: "Confirmed via text." },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.after.notes).toContain("Existing note from earlier.");
    expect(body.after.notes).toContain("Confirmed via text.");
    // Timestamp prefix
    expect(body.after.notes).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2} PT\] Confirmed via text\./);
  });

  it("9. PII redaction — phone shows masked in activity feed, full in audit", async () => {
    const { executeTool } = await loadTools();
    const ride = makeRide();
    await executeTool(
      "update_ride",
      {
        ride_id: ride.id,
        passenger_phone: "+1 (310) 555-9999",
      },
      fakeEnv as any,
      fakeCtx,
    );
    expect(db.events).toHaveLength(1);
    const feedMsg = db.events[0].message as string;
    expect(feedMsg).toContain("***-***-9999");
    expect(feedMsg).not.toContain("310");
    expect(feedMsg).not.toContain("5559999");

    // Audit row has the full unredacted value in after_json.
    const after = JSON.parse(db.audit[0].after_json);
    expect(after.passenger_phone).toBe("+1 (310) 555-9999");
  });

  it("10. rate limit — 101st request in a minute returns 429", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    const actor = "mcp:claude";
    let lastVerdict;
    for (let i = 0; i < 101; i++) {
      lastVerdict = await checkRateLimit(fakeEnv as any, actor);
    }
    expect(lastVerdict?.allowed).toBe(false);
    expect(lastVerdict?.reason).toContain("per-minute");
    expect(lastVerdict?.minuteCount).toBe(101);
  });
});

// ────────────────────────────────────────────────────────────────────
// Session 2: update_client + link_ride_to_client
// ────────────────────────────────────────────────────────────────────

describe("update_client", () => {
  it("1. happy path — update phone + email; before/after correct", async () => {
    const { executeTool } = await loadTools();
    const client = makeClient();

    const res = await executeTool(
      "update_client",
      {
        client_id: client.id,
        phone: "+1 (310) 555-7777",
        email: "greg@newdomain.com",
      },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.client_id).toBe(client.id);
    expect(body.before.phone).toBe("+1 (619) 555-1086");
    expect(body.after.phone).toBe("+1 (310) 555-7777");
    expect(body.before.email).toBe("greg@example.com");
    expect(body.after.email).toBe("greg@newdomain.com");
    expect(body.changed_fields).toContain("phone");
    expect(body.changed_fields).toContain("email");
    expect(body.audit_id).toBeTruthy();

    expect(db.audit).toHaveLength(1);
    expect(db.audit[0].entity_type).toBe("client");
    expect(db.audit[0].actor).toBe("mcp:claude");
    expect(db.events).toHaveLength(1);
  });

  it("2. address change preserves history — old goes into previous_addresses with timestamp", async () => {
    const { executeTool } = await loadTools();
    const oldAddr = "1 Cape Danbury, Newport Beach, CA 92625";
    const newAddr = "555 Ocean Blvd, Laguna Beach, CA 92651";
    const client = makeClient({ home_address: oldAddr });

    const res = await executeTool(
      "update_client",
      { client_id: client.id, home_address: newAddr },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.after.home_address).toBe(newAddr);
    expect(body.changed_fields).toContain("home_address");
    expect(body.changed_fields).toContain("previous_addresses");

    const history = JSON.parse(body.after.previous_addresses as string);
    expect(history).toHaveLength(1);
    expect(history[0].address).toBe(oldAddr);
    expect(typeof history[0].changed_at).toBe("string");
    expect(new Date(history[0].changed_at).toString()).not.toBe("Invalid Date");
  });

  it("3. no-op — only client_id, changed_fields is []", async () => {
    const { executeTool } = await loadTools();
    const client = makeClient();
    const res = await executeTool(
      "update_client",
      { client_id: client.id },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.changed_fields).toEqual([]);
    expect(body.audit_id).toBeNull();
    expect(db.audit).toHaveLength(0);
    expect(db.events).toHaveLength(0);
  });

  it("4. not found — bad client_id returns 404", async () => {
    const { executeTool } = await loadTools();
    const res = await executeTool(
      "update_client",
      { client_id: "00000000-0000-0000-0000-000000000000" },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBe(true);
    const body = parseResult(res);
    expect(body.status).toBe(404);
    expect(body.error).toContain("not found");
  });

  it("5. invalid default_billing enum returns 400 with valid values", async () => {
    const { executeTool } = await loadTools();
    const client = makeClient();
    const res = await executeTool(
      "update_client",
      { client_id: client.id, default_billing: "bitcoin" },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBe(true);
    const body = parseResult(res);
    expect(body.status).toBe(400);
    expect(body.valid_values).toContain("cash");
    expect(body.valid_values).toContain("company_billing");
  });

  it("6. PII redaction — activity feed redacts phone/email/address; audit has full values", async () => {
    const { executeTool } = await loadTools();
    const client = makeClient({
      home_address: "1 Cape Danbury, Newport Beach, CA 92625",
    });
    await executeTool(
      "update_client",
      {
        client_id: client.id,
        phone: "+1 (310) 555-9999",
        email: "newmail@gmail.com",
        home_address: "55 Beach Rd, Laguna Beach, CA 92651",
      },
      fakeEnv as any,
      fakeCtx,
    );

    expect(db.events).toHaveLength(1);
    const feedMsg = db.events[0].message as string;
    // phone: only last 4
    expect(feedMsg).toContain("***-***-9999");
    expect(feedMsg).not.toContain("310");
    expect(feedMsg).not.toContain("5559999");
    // email: first letter + domain
    expect(feedMsg).toContain("n***@gmail.com");
    expect(feedMsg).not.toContain("newmail@gmail.com");
    // home_address: city + state only
    expect(feedMsg).toContain("Laguna Beach, CA");
    expect(feedMsg).not.toContain("55 Beach Rd");
    expect(feedMsg).not.toContain("92651");

    // Audit has full unredacted values.
    const after = JSON.parse(db.audit[0].after_json);
    expect(after.phone).toBe("+1 (310) 555-9999");
    expect(after.email).toBe("newmail@gmail.com");
    expect(after.home_address).toBe("55 Beach Rd, Laguna Beach, CA 92651");
  });
});

describe("link_ride_to_client", () => {
  it("7. happy path — orphan ride (client_id=null) gets linked", async () => {
    const { executeTool } = await loadTools();
    const client = makeClient({ name: "Kevin Morgan" });
    const ride = makeRide({ client_id: null });

    const res = await executeTool(
      "link_ride_to_client",
      { ride_id: ride.id, client_id: client.id },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.before.client_id).toBeNull();
    expect(body.after.client_id).toBe(client.id);
    expect(body.changed_fields).toEqual(["client_id"]);
    expect(body.audit_id).toBeTruthy();
    expect(body.warnings).toEqual([]);

    expect(db.audit).toHaveLength(1);
    expect(db.audit[0].entity_type).toBe("ride");
    expect(db.audit[0].action).toBe("link");
    expect(db.events).toHaveLength(1);
    expect(db.events[0].message).toContain("Kevin Morgan");
  });

  it("8. refuses to overwrite — existing client_id, no force → 409", async () => {
    const { executeTool } = await loadTools();
    const oldClient = makeClient({ name: "Old Linked Client" });
    const newClient = makeClient({ name: "Different Person" });
    const ride = makeRide({ client_id: oldClient.id });

    const res = await executeTool(
      "link_ride_to_client",
      { ride_id: ride.id, client_id: newClient.id },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBe(true);
    const body = parseResult(res);
    expect(body.status).toBe(409);
    expect(body.current.id).toBe(oldClient.id);
    expect(body.current.name).toBe("Old Linked Client");
    expect(body.error).toContain("force");
    // Ride should NOT have been updated.
    expect(db.rides[ride.id].client_id).toBe(oldClient.id);
    expect(db.audit).toHaveLength(0);
  });

  it("9. force=true overwrites and logs a warning", async () => {
    const { executeTool } = await loadTools();
    const oldClient = makeClient({ name: "Old Linked Client" });
    const newClient = makeClient({ name: "New Linked Client" });
    const ride = makeRide({ client_id: oldClient.id });

    const res = await executeTool(
      "link_ride_to_client",
      { ride_id: ride.id, client_id: newClient.id, force: true },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.after.client_id).toBe(newClient.id);
    expect(body.warnings.length).toBeGreaterThanOrEqual(1);
    expect(body.warnings[0]).toContain("force");
    expect(db.audit).toHaveLength(1);
    expect(db.events[0].metadata.force).toBe(true);
  });

  it("10. bad client_id → 404", async () => {
    const { executeTool } = await loadTools();
    const ride = makeRide({ client_id: null });

    const res = await executeTool(
      "link_ride_to_client",
      {
        ride_id: ride.id,
        client_id: "00000000-0000-0000-0000-000000000000",
      },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBe(true);
    const body = parseResult(res);
    expect(body.status).toBe(404);
    expect(body.error).toContain("Client not found");
    expect(db.rides[ride.id].client_id).toBeNull();
    expect(db.audit).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// Session 3: add_driver + update_driver
// ────────────────────────────────────────────────────────────────────

describe("add_driver", () => {
  it("1. happy path — create Carlos Garcia with phone", async () => {
    const { executeTool } = await loadTools();
    const res = await executeTool(
      "add_driver",
      { full_name: "Carlos Garcia", phone: "+1 (619) 555-2222" },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.driver_id).toBeTruthy();
    expect(body.driver.full_name).toBe("Carlos Garcia");
    expect(body.driver.phone).toBe("+1 (619) 555-2222");
    expect(body.driver.status).toBe("active");
    expect(body.driver.active).toBe(true);
    expect(body.audit_id).toBeTruthy();
    expect(body.warnings).toEqual([]);

    expect(db.drivers).toHaveLength(1);
    expect(db.drivers[0].id).toBe(body.driver_id);
    expect(db.audit).toHaveLength(1);
    expect(db.audit[0].entity_type).toBe("driver");
    expect(db.audit[0].action).toBe("create");
    expect(db.events[0].message).toContain("Carlos Garcia");
  });

  it("2. duplicate name returns 409 with existing record", async () => {
    const { executeTool } = await loadTools();
    const existing = makeDriver({
      full_name: "Carlos Garcia",
      phone: "+1 (619) 555-1234",
    });

    const res = await executeTool(
      "add_driver",
      { full_name: "Carlos Garcia" },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBe(true);
    const body = parseResult(res);
    expect(body.status).toBe(409);
    expect(body.existing.id).toBe(existing.id);
    expect(body.existing.full_name).toBe("Carlos Garcia");
    expect(body.error).toContain("update_driver");
    // No new row created.
    expect(db.drivers).toHaveLength(1);
    expect(db.audit).toHaveLength(0);
  });

  it("3. case-insensitive + whitespace-tolerant duplicate detection", async () => {
    const { executeTool } = await loadTools();
    makeDriver({ full_name: "Carlos Garcia" });

    const res = await executeTool(
      "add_driver",
      { full_name: "  carlos   garcia  " },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBe(true);
    const body = parseResult(res);
    expect(body.status).toBe(409);
    expect(body.existing.full_name).toBe("Carlos Garcia");
    expect(db.drivers).toHaveLength(1);
  });

  it("4. minimal input — only full_name — succeeds with status=active", async () => {
    const { executeTool } = await loadTools();
    const res = await executeTool(
      "add_driver",
      { full_name: "Brand New Driver" },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.driver.full_name).toBe("Brand New Driver");
    expect(body.driver.status).toBe("active");
    expect(body.driver.active).toBe(true);
    expect(body.driver.phone).toBeNull();
    expect(body.driver.email).toBeNull();
  });

  it("5. invalid status enum returns 400", async () => {
    const { executeTool } = await loadTools();
    const res = await executeTool(
      "add_driver",
      { full_name: "Test Driver", status: "retired" },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBe(true);
    const body = parseResult(res);
    expect(body.status).toBe(400);
    expect(body.valid_values).toEqual(["active", "inactive"]);
    expect(db.drivers).toHaveLength(0);
  });
});

describe("update_driver", () => {
  it("6. happy path — add phone to existing driver", async () => {
    const { executeTool } = await loadTools();
    const driver = makeDriver({ full_name: "Hassan", phone: null });

    const res = await executeTool(
      "update_driver",
      { driver_id: driver.id, phone: "+1 (619) 555-9001" },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.before.phone).toBeNull();
    expect(body.after.phone).toBe("+1 (619) 555-9001");
    expect(body.changed_fields).toEqual(["phone"]);
    expect(body.audit_id).toBeTruthy();
    expect(body.warnings).toEqual([]);
    expect(db.audit).toHaveLength(1);
    expect(db.audit[0].entity_type).toBe("driver");
    expect(db.events).toHaveLength(1);
  });

  it("7. no-op — only driver_id, returns empty changed_fields", async () => {
    const { executeTool } = await loadTools();
    const driver = makeDriver();

    const res = await executeTool(
      "update_driver",
      { driver_id: driver.id },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.changed_fields).toEqual([]);
    expect(body.audit_id).toBeNull();
    expect(db.audit).toHaveLength(0);
    expect(db.events).toHaveLength(0);
  });

  it("8. not found — bad driver_id returns 404", async () => {
    const { executeTool } = await loadTools();
    const res = await executeTool(
      "update_driver",
      { driver_id: "00000000-0000-0000-0000-000000000000", phone: "anything" },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBe(true);
    const body = parseResult(res);
    expect(body.status).toBe(404);
    expect(body.error).toContain("not found");
  });

  it("9. status='inactive' returns a warning and flips active flag", async () => {
    const { executeTool } = await loadTools();
    const driver = makeDriver({ status: "active", active: true });

    const res = await executeTool(
      "update_driver",
      { driver_id: driver.id, status: "inactive" },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.after.status).toBe("inactive");
    expect(body.after.active).toBe(false);
    expect(body.warnings.length).toBeGreaterThanOrEqual(1);
    expect(body.warnings[0].toLowerCase()).toContain("inactive");
  });

  it("10. PII redaction — phone/email masked in feed, full in audit", async () => {
    const { executeTool } = await loadTools();
    const driver = makeDriver({
      full_name: "Hassan",
      phone: null,
      email: null,
    });

    await executeTool(
      "update_driver",
      {
        driver_id: driver.id,
        phone: "+1 (310) 555-4242",
        email: "hassan@example.com",
      },
      fakeEnv as any,
      fakeCtx,
    );

    expect(db.events).toHaveLength(1);
    const feedMsg = db.events[0].message as string;
    expect(feedMsg).toContain("***-***-4242");
    expect(feedMsg).not.toContain("310");
    expect(feedMsg).not.toContain("5554242");
    expect(feedMsg).toContain("h***@example.com");
    expect(feedMsg).not.toContain("hassan@example.com");

    const after = JSON.parse(db.audit[0].after_json);
    expect(after.phone).toBe("+1 (310) 555-4242");
    expect(after.email).toBe("hassan@example.com");
  });
});

// ────────────────────────────────────────────────────────────────────
// Session 4: fuzzy-resolve by name + divergence/normalization fixes
// ────────────────────────────────────────────────────────────────────

describe("update_driver — fuzzy resolve by full_name", () => {
  it("resolves a driver by full_name (no driver_id) — happy path", async () => {
    const { executeTool } = await loadTools();
    const driver = makeDriver({ full_name: "Hassan", phone: null });

    const res = await executeTool(
      "update_driver",
      { full_name: "hassan", phone: "+1 (619) 555-3000" },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.driver_id).toBe(driver.id);
    expect(body.after.phone).toBe("+1 (619) 555-3000");
  });

  it("ambiguous full_name returns 400 with candidates", async () => {
    const { executeTool } = await loadTools();
    makeDriver({ full_name: "David Santiago" });
    makeDriver({ full_name: "David Garcia" });

    const res = await executeTool(
      "update_driver",
      { full_name: "David", phone: "+1 (000) 000-0000" },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBe(true);
    const body = parseResult(res);
    expect(body.status).toBe(400);
    expect(body.candidates).toHaveLength(2);
    expect(body.candidates.map((c: any) => c.full_name).sort()).toEqual([
      "David Garcia",
      "David Santiago",
    ]);
  });
});

describe("update_client — fuzzy resolve by name", () => {
  it("resolves a client by name (no client_id) — happy path", async () => {
    const { executeTool } = await loadTools();
    const client = makeClient({ name: "Greg Vazquez" });

    const res = await executeTool(
      "update_client",
      { name: "  greg   vazquez  ", phone: "+1 (000) 555-9999" },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.client_id).toBe(client.id);
    expect(body.after.phone).toBe("+1 (000) 555-9999");
  });

  it("ambiguous name returns 400 with candidates", async () => {
    const { executeTool } = await loadTools();
    makeClient({ name: "Kevin Morgan" });
    makeClient({ name: "Kevin Spencer" });

    const res = await executeTool(
      "update_client",
      { name: "Kevin", phone: "anything" },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBe(true);
    const body = parseResult(res);
    expect(body.status).toBe(400);
    expect(body.candidates).toHaveLength(2);
  });
});

describe("update_driver — inactive + future-rides warning", () => {
  it("lists future rides as a second warning when going inactive", async () => {
    const { executeTool } = await loadTools();
    const driver = makeDriver({ status: "active", active: true });
    const future1 = makeRide({
      driver_id: driver.id,
      status: "scheduled",
      pickup_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const future2 = makeRide({
      driver_id: driver.id,
      status: "in_progress",
      pickup_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    });
    // A past ride should NOT be listed.
    makeRide({
      driver_id: driver.id,
      status: "scheduled",
      pickup_at: new Date(Date.now() - 86_400_000).toISOString(),
    });
    // A different driver's future ride should NOT be listed.
    const otherDriver = makeDriver({ full_name: "Other Driver" });
    makeRide({
      driver_id: otherDriver.id,
      status: "scheduled",
      pickup_at: new Date(Date.now() + 86_400_000).toISOString(),
    });

    const res = await executeTool(
      "update_driver",
      { driver_id: driver.id, status: "inactive" },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.warnings.length).toBe(2);
    expect(body.warnings[0]).toContain("inactive");
    expect(body.warnings[1]).toContain("2 future rides");
    expect(body.warnings[1]).toContain(future1.id);
    expect(body.warnings[1]).toContain(future2.id);
  });
});

describe("find_or_create_client — normalization + divergence", () => {
  it("matches existing client across whitespace + case", async () => {
    const { executeTool } = await loadTools();
    const existing = makeClient({ name: "Greg Vazquez" });

    const res = await executeTool(
      "find_or_create_client",
      { name: "  greg   vazquez  " },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.found).toBe(true);
    expect(body.client.id).toBe(existing.id);
    expect(body.warnings).toEqual([]);
    // No duplicate row inserted.
    expect(Object.keys(db.clients)).toHaveLength(1);
  });

  it("emits warning per diverging field on lookup hit", async () => {
    const { executeTool } = await loadTools();
    makeClient({
      name: "Greg Vazquez",
      phone: "+1 (619) 555-1086",
      email: "greg@old.com",
      default_billing: "card",
    });

    const res = await executeTool(
      "find_or_create_client",
      {
        name: "Greg Vazquez",
        phone: "+1 (000) 555-9999",
        email: "greg@new.com",
        default_billing: "cash",
      },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.found).toBe(true);
    expect(body.warnings).toHaveLength(3);
    expect(body.warnings.some((w: string) => w.includes("phone"))).toBe(true);
    expect(body.warnings.some((w: string) => w.includes("email"))).toBe(true);
    expect(
      body.warnings.some((w: string) => w.includes("default_billing")),
    ).toBe(true);
    // Stored values must not have been overwritten.
    const stored = Object.values(db.clients)[0] as any;
    expect(stored.phone).toBe("+1 (619) 555-1086");
    expect(stored.email).toBe("greg@old.com");
    expect(stored.default_billing).toBe("card");
  });
});

describe("update_client — previous_addresses cap at 20 FIFO", () => {
  it("caps history at 20 and evicts the oldest first", async () => {
    const { executeTool } = await loadTools();
    // Seed with 20 entries so the next change forces an eviction.
    const seedHistory = Array.from({ length: 20 }, (_, i) => ({
      address: `Seed Address ${i}`,
      changed_at: new Date(2020, 0, i + 1).toISOString(),
    }));
    const client = makeClient({
      name: "Mover",
      home_address: "Most Recent Address",
      previous_addresses: JSON.stringify(seedHistory),
    });

    const res = await executeTool(
      "update_client",
      {
        client_id: client.id,
        home_address: "Brand New Address",
      },
      fakeEnv as any,
      fakeCtx,
    );

    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    const history = JSON.parse(body.after.previous_addresses as string);
    expect(history).toHaveLength(20);
    // The oldest seed entry should be gone.
    expect(history[0].address).not.toBe("Seed Address 0");
    expect(history[0].address).toBe("Seed Address 1");
    // The most recent prior address (the one we just replaced) should
    // now be the last entry.
    expect(history[history.length - 1].address).toBe("Most Recent Address");
  });
});

// Bonus: redaction helper unit tests, since they're the security
// boundary for the activity feed.
describe("pii helpers", () => {
  it("redactPhone shows last 4 digits", async () => {
    const { redactPhone } = await import("./pii");
    expect(redactPhone("+1 (619) 555-1086")).toBe("***-***-1086");
    expect(redactPhone("619-555-1086")).toBe("***-***-1086");
    expect(redactPhone("5551086")).toBe("***-1086");
    expect(redactPhone("")).toBe("");
    expect(redactPhone(null)).toBe("");
  });
  it("redactEmail shows first letter + domain", async () => {
    const { redactEmail } = await import("./pii");
    expect(redactEmail("greg@gmail.com")).toBe("g***@gmail.com");
    expect(redactEmail("x@y.io")).toBe("x***@y.io");
    expect(redactEmail("nope")).toBe("***");
  });
  it("redactAddress shows city + state only", async () => {
    const { redactAddress } = await import("./pii");
    expect(redactAddress("11125 Sands Ave, Newport Beach, CA 92660")).toBe(
      "Newport Beach, CA",
    );
    expect(redactAddress("Newport Beach, CA")).toBe("Newport Beach, CA");
    expect(redactAddress("")).toBe("");
  });
});

// ────────────────────────────────────────────────────────────────────
// Expenses + invoices tools (Phase 3 / 4)
// ────────────────────────────────────────────────────────────────────

describe("log_fixed_expense", () => {
  it("creates a row + activity event", async () => {
    const { executeTool } = await loadTools();
    const res = await executeTool(
      "log_fixed_expense",
      {
        category: "insurance",
        label: "GEICO Commercial Auto",
        amount_dollars: 300,
        cadence: "monthly",
      },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.expense.amount_cents).toBe(30000);
    expect(body.expense.cadence).toBe("monthly");
    expect(db.expenses_fixed).toHaveLength(1);
    expect(db.events.some((e: any) => /Fixed expense/.test(e.message))).toBe(
      true,
    );
  });

  it("rejects non-positive amount", async () => {
    const { executeTool } = await loadTools();
    const res = await executeTool(
      "log_fixed_expense",
      { category: "insurance", label: "x", amount_dollars: 0 },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBe(true);
    const body = parseResult(res);
    expect(body.status).toBe(400);
  });
});

describe("log_maintenance", () => {
  it("creates a record with amortization interval", async () => {
    const { executeTool } = await loadTools();
    const vehicle = {
      id: cryptoRandom(),
      display_name: "2023 Escalade ESV",
      plate: "ABC123",
      active: true,
    };
    db.vehicles.push(vehicle);
    const res = await executeTool(
      "log_maintenance",
      {
        vehicle_name: "Escalade",
        category: "oil",
        label: "Synthetic + filter",
        amount_dollars: 90,
        service_interval_days: 90,
      },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.record.vehicle_id).toBe(vehicle.id);
    expect(body.record.service_interval_days).toBe(90);
    expect(body.record.amount_cents).toBe(9000);
  });

  it("404s on unknown vehicle name", async () => {
    const { executeTool } = await loadTools();
    const res = await executeTool(
      "log_maintenance",
      {
        vehicle_name: "Nope",
        category: "oil",
        label: "x",
        amount_dollars: 50,
      },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBe(true);
    expect(parseResult(res).status).toBe(404);
  });
});

describe("log_ride_cost", () => {
  it("creates an estimate without an actual", async () => {
    const { executeTool } = await loadTools();
    const ride = makeRide();
    const res = await executeTool(
      "log_ride_cost",
      {
        ride_id: ride.id,
        category: "gas",
        estimated_dollars: 35,
      },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.ride_cost.estimated_cents).toBe(3500);
    expect(body.ride_cost.actual_cents).toBeNull();
    expect(body.ride_cost.confirmed_at).toBeNull();
  });

  it("stamps confirmed_at when actual is provided", async () => {
    const { executeTool } = await loadTools();
    const ride = makeRide();
    const res = await executeTool(
      "log_ride_cost",
      {
        ride_id: ride.id,
        category: "gas",
        actual_dollars: 38,
      },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.ride_cost.actual_cents).toBe(3800);
    expect(body.ride_cost.confirmed_at).toBeTruthy();
  });

  it("404s on unknown ride", async () => {
    const { executeTool } = await loadTools();
    const res = await executeTool(
      "log_ride_cost",
      {
        ride_id: "00000000-0000-0000-0000-000000000000",
        category: "gas",
        estimated_dollars: 25,
      },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBe(true);
    expect(parseResult(res).status).toBe(404);
  });
});

describe("list_invoices", () => {
  it("returns open invoices by default and enriches with client / ride", async () => {
    const { executeTool } = await loadTools();
    const client = makeClient({ name: "Goldman Sachs", company: "Goldman Sachs" });
    const ride = makeRide({ client_id: client.id });
    db.invoices.push({
      id: cryptoRandom(),
      ride_id: ride.id,
      number: "SDL-1001",
      amount_cents: 18200,
      status: "sent",
      terms: "net_30",
      due_date: "2099-12-31",
      paid_at: null,
      created_at: new Date().toISOString(),
    });
    const res = await executeTool(
      "list_invoices",
      {},
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.count).toBe(1);
    expect(body.invoices[0].client_name).toBe(client.name);
    expect(body.invoices[0].effective_status).toBe("sent");
    expect(body.invoices[0].amount_dollars).toBe(182);
  });

  it("filter='paid' excludes sent", async () => {
    const { executeTool } = await loadTools();
    db.invoices.push(
      {
        id: cryptoRandom(),
        ride_id: null,
        number: "SDL-1",
        amount_cents: 1000,
        status: "sent",
        terms: null,
        due_date: null,
        paid_at: null,
        created_at: new Date().toISOString(),
      },
      {
        id: cryptoRandom(),
        ride_id: null,
        number: "SDL-2",
        amount_cents: 2000,
        status: "paid",
        terms: null,
        due_date: null,
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    );
    const res = await executeTool(
      "list_invoices",
      { status: "paid" },
      fakeEnv as any,
      fakeCtx,
    );
    const body = parseResult(res);
    expect(body.count).toBe(1);
    expect(body.invoices[0].number).toBe("SDL-2");
  });
});

describe("mark_invoice_paid", () => {
  it("happy path — by invoice_number, stamps paid_at, writes event", async () => {
    const { executeTool } = await loadTools();
    db.invoices.push({
      id: cryptoRandom(),
      ride_id: null,
      number: "SDL-1042",
      amount_cents: 18200,
      status: "sent",
      terms: "net_30",
      due_date: "2026-06-15",
      paid_at: null,
      created_at: new Date().toISOString(),
    });
    const res = await executeTool(
      "mark_invoice_paid",
      { invoice_number: "SDL-1042" },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBeUndefined();
    const body = parseResult(res);
    expect(body.before.status).toBe("sent");
    expect(body.after.status).toBe("paid");
    expect(body.after.paid_at).toBeTruthy();
    expect(
      db.events.some((e: any) => /marked paid/.test(e.message)),
    ).toBe(true);
  });

  it("409 on already-paid without force", async () => {
    const { executeTool } = await loadTools();
    db.invoices.push({
      id: cryptoRandom(),
      ride_id: null,
      number: "SDL-9",
      amount_cents: 5000,
      status: "paid",
      terms: null,
      due_date: null,
      paid_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    const res = await executeTool(
      "mark_invoice_paid",
      { invoice_number: "SDL-9" },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBe(true);
    expect(parseResult(res).status).toBe(409);
  });

  it("rejects when nothing matches", async () => {
    const { executeTool } = await loadTools();
    const res = await executeTool(
      "mark_invoice_paid",
      { invoice_number: "SDL-NOPE" },
      fakeEnv as any,
      fakeCtx,
    );
    expect(res.isError).toBe(true);
    expect(parseResult(res).status).toBe(404);
  });
});
