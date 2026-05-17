// Expenses — owner-only page for managing the company's cost side.
//
// Three tabs:
//   Fixed       — recurring costs (insurance, lease, phone, software).
//                 Allocated per-day to whatever window the dashboard
//                 looks at.
//   Per-ride    — rollup of variable costs attached to individual
//                 rides (gas, tolls, parking, amenities, tip-outs).
//                 Editing happens on each ride; this is the summary.
//   Maintenance — one-time vehicle service spend. Amortized over
//                 service_interval_days when set.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteFixedExpense,
  deleteMaintenance,
  EMPTY_RIDE_COST_DEFAULTS,
  getOrgSettings,
  listAllVehicles,
  listFixedExpenses,
  listMaintenance,
  listRideCostsForRides,
  listRides,
  updateOrgSettings,
  upsertFixedExpense,
  upsertMaintenance,
  type RideCostDefaults,
} from "../lib/api";
import { fmtMoney } from "../lib/format";
import {
  FIXED_CADENCE_LABEL,
  FIXED_CATEGORY_LABEL,
  MAINTENANCE_CATEGORY_LABEL,
  RIDE_COST_CATEGORY_LABEL,
  fixedExpenseAllocatedCents,
  maintenanceAllocatedCents,
} from "../lib/expenses";
import type {
  ExpenseFixed,
  FixedExpenseCadence,
  FixedExpenseCategory,
  MaintenanceCategory,
  Ride,
  RideCost,
  Vehicle,
  VehicleMaintenance,
} from "../lib/types";

type TabId = "fixed" | "perride" | "maintenance";

// ── Page header ──────────────────────────────────────────────────
function PageHeader() {
  return (
    <div
      className="flex items-end justify-between gap-6 pb-7 mb-7 flex-wrap"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="min-w-0">
        <p className="eyebrow mb-3" style={{ letterSpacing: "0.22em" }}>
          Operations · costs
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
          The other half of the{" "}
          <span style={{ fontStyle: "italic", color: "var(--accent)" }}>
            ledger
          </span>
          .
        </h1>
        <p
          className="text-muted mt-3"
          style={{ fontSize: 14.5, maxWidth: 560, lineHeight: 1.55 }}
        >
          Fixed costs, per-ride variables, and the maintenance that keeps
          the cars on the road. Every number here lands on the Earnings
          page as profit (or doesn't).
        </p>
      </div>
    </div>
  );
}

function TabStrip({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
}) {
  const tabs: { id: TabId; label: string }[] = [
    { id: "fixed", label: "Fixed" },
    { id: "perride", label: "Per-ride" },
    { id: "maintenance", label: "Maintenance" },
  ];
  return (
    <div
      role="tablist"
      className="flex gap-1 mb-6"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            style={{
              position: "relative",
              padding: "12px 16px 14px",
              fontSize: 13.5,
              fontWeight: on ? 600 : 500,
              color: on ? "var(--text)" : "var(--text-muted)",
              background: "transparent",
              border: 0,
              cursor: "pointer",
              borderBottom: on
                ? "2px solid var(--accent)"
                : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Generic empty card ──────────────────────────────────────────
function EmptyCard({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-[6px] p-8 text-center"
      style={{
        background: "var(--surface-2)",
        border: "1px dashed var(--border)",
      }}
    >
      <h3
        className="serif"
        style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.005em" }}
      >
        {title}
      </h3>
      <p
        className="text-muted mt-2 mx-auto"
        style={{ fontSize: 13.5, maxWidth: 420, lineHeight: 1.55 }}
      >
        {body}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

// ── Fixed tab ───────────────────────────────────────────────────
type FixedDraft = {
  id?: string;
  category: FixedExpenseCategory;
  label: string;
  amount: string; // dollars typed
  cadence: FixedExpenseCadence;
  effective_from: string;
  effective_to: string;
  vehicle_id: string;
  notes: string;
};

const EMPTY_FIXED: FixedDraft = {
  category: "insurance",
  label: "",
  amount: "",
  cadence: "monthly",
  effective_from: new Date().toISOString().slice(0, 10),
  effective_to: "",
  vehicle_id: "",
  notes: "",
};

function FixedTab({
  expenses,
  vehicles,
  onReload,
}: {
  expenses: ExpenseFixed[];
  vehicles: Vehicle[];
  onReload: () => void;
}) {
  const [draft, setDraft] = useState<FixedDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Allocated to *this month* — gives a sense of monthly outflow.
  const monthAllocated = useMemo(() => {
    const now = new Date();
    const from = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0),
    );
    const to = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59),
    );
    return fixedExpenseAllocatedCents(expenses, from, to);
  }, [expenses]);

  // Active = no effective_to or effective_to >= today
  const active = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return expenses.filter(
      (e) => !e.effective_to || e.effective_to >= today,
    );
  }, [expenses]);
  const archived = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return expenses.filter(
      (e) => e.effective_to && e.effective_to < today,
    );
  }, [expenses]);

  const startNew = () => {
    setError(null);
    setDraft({ ...EMPTY_FIXED });
  };
  const startEdit = (e: ExpenseFixed) => {
    setError(null);
    setDraft({
      id: e.id,
      category: e.category,
      label: e.label,
      amount: (e.amount_cents / 100).toString(),
      cadence: e.cadence,
      effective_from: e.effective_from,
      effective_to: e.effective_to ?? "",
      vehicle_id: e.vehicle_id ?? "",
      notes: e.notes ?? "",
    });
  };
  const save = async () => {
    if (!draft) return;
    if (!draft.label.trim()) {
      setError("Add a label so you remember what this is.");
      return;
    }
    const cents = Math.round(parseFloat(draft.amount || "0") * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Amount must be a positive number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await upsertFixedExpense({
        ...(draft.id ? { id: draft.id } : {}),
        category: draft.category,
        label: draft.label.trim(),
        amount_cents: cents,
        cadence: draft.cadence,
        effective_from: draft.effective_from,
        effective_to: draft.effective_to || null,
        vehicle_id: draft.vehicle_id || null,
        notes: draft.notes.trim() || null,
      });
      setDraft(null);
      onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };
  const archiveRow = async (e: ExpenseFixed) => {
    if (!confirm(`Archive "${e.label}"? It won't count toward future windows.`)) {
      return;
    }
    setBusy(true);
    try {
      await upsertFixedExpense({
        id: e.id,
        effective_to: new Date().toISOString().slice(0, 10),
      });
      onReload();
    } finally {
      setBusy(false);
    }
  };
  const remove = async (e: ExpenseFixed) => {
    if (!confirm(`Delete "${e.label}" permanently? Historical allocations using this row will disappear.`)) {
      return;
    }
    setBusy(true);
    try {
      await deleteFixedExpense(e.id);
      onReload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <p className="eyebrow" style={{ letterSpacing: "0.22em" }}>
            This month, allocated
          </p>
          <div
            className="serif tnum mt-1"
            style={{ fontSize: 28, letterSpacing: "-0.01em" }}
          >
            {fmtMoney(monthAllocated)}
          </div>
        </div>
        {!draft ? (
          <button className="btn btn-primary" onClick={startNew}>
            Add fixed expense
          </button>
        ) : null}
      </div>

      {draft ? (
        <FixedDraftEditor
          draft={draft}
          setDraft={setDraft}
          vehicles={vehicles}
          onCancel={() => setDraft(null)}
          onSave={save}
          busy={busy}
          error={error}
        />
      ) : null}

      {active.length === 0 && archived.length === 0 ? (
        <EmptyCard
          title="No fixed costs yet"
          body="Insurance, lease, phone, software — anything that shows up on a regular cadence. Each row lets you set monthly, weekly, or annual amounts."
          action={
            <button className="btn btn-primary" onClick={startNew}>
              Add your first fixed expense
            </button>
          }
        />
      ) : null}

      {active.length > 0 ? (
        <FixedTable
          rows={active}
          vehicles={vehicles}
          onEdit={startEdit}
          onArchive={archiveRow}
          busy={busy}
        />
      ) : null}

      {archived.length > 0 ? (
        <>
          <p
            className="eyebrow mt-8 mb-3"
            style={{ letterSpacing: "0.22em" }}
          >
            Archived
          </p>
          <FixedTable
            rows={archived}
            vehicles={vehicles}
            onEdit={startEdit}
            onArchive={remove} // archived rows: action is delete
            archivedView
            busy={busy}
          />
        </>
      ) : null}
    </div>
  );
}

function FixedDraftEditor({
  draft,
  setDraft,
  vehicles,
  onCancel,
  onSave,
  busy,
  error,
}: {
  draft: FixedDraft;
  setDraft: (d: FixedDraft) => void;
  vehicles: Vehicle[];
  onCancel: () => void;
  onSave: () => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <div
      className="rounded-[6px] p-5 md:p-6 mb-5 fade-up"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Category</label>
          <select
            className="field"
            value={draft.category}
            onChange={(e) =>
              setDraft({
                ...draft,
                category: e.target.value as FixedExpenseCategory,
              })
            }
          >
            {Object.entries(FIXED_CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Label</label>
          <input
            className="field"
            placeholder="GEICO Commercial Auto"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Amount (USD)</label>
          <input
            className="field tnum"
            inputMode="decimal"
            placeholder="0.00"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Cadence</label>
          <select
            className="field"
            value={draft.cadence}
            onChange={(e) =>
              setDraft({
                ...draft,
                cadence: e.target.value as FixedExpenseCadence,
              })
            }
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
        <div>
          <label className="label">Effective from</label>
          <input
            type="date"
            className="field"
            value={draft.effective_from}
            onChange={(e) =>
              setDraft({ ...draft, effective_from: e.target.value })
            }
          />
        </div>
        <div>
          <label className="label">Effective to (optional)</label>
          <input
            type="date"
            className="field"
            value={draft.effective_to}
            onChange={(e) =>
              setDraft({ ...draft, effective_to: e.target.value })
            }
          />
        </div>
        <div>
          <label className="label">Vehicle (optional)</label>
          <select
            className="field"
            value={draft.vehicle_id}
            onChange={(e) =>
              setDraft({ ...draft, vehicle_id: e.target.value })
            }
          >
            <option value="">All vehicles / general</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.display_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Notes</label>
          <input
            className="field"
            placeholder="Renewal Dec 2026"
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </div>
      </div>
      {error ? (
        <p className="text-danger mt-3" style={{ fontSize: 13 }}>
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-2 mt-5">
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={onSave}
        >
          {busy ? "Saving…" : draft.id ? "Save changes" : "Add expense"}
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function FixedTable({
  rows,
  vehicles,
  onEdit,
  onArchive,
  archivedView = false,
  busy,
}: {
  rows: ExpenseFixed[];
  vehicles: Vehicle[];
  onEdit: (e: ExpenseFixed) => void;
  onArchive: (e: ExpenseFixed) => void;
  archivedView?: boolean;
  busy: boolean;
}) {
  return (
    <div
      className="rounded-[6px] overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full" style={{ fontSize: 13 }}>
          <thead>
            <tr
              className="text-left"
              style={{
                fontSize: 10.5,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Cadence</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Effective</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => {
              const v = vehicles.find((x) => x.id === e.vehicle_id);
              return (
                <tr
                  key={e.id}
                  style={{
                    borderTop:
                      i === 0 ? "none" : "1px solid var(--border)",
                  }}
                >
                  <td className="px-4 py-3">
                    <div style={{ fontWeight: 500 }}>{e.label}</div>
                    <div
                      className="text-muted"
                      style={{ fontSize: 11.5 }}
                    >
                      {FIXED_CATEGORY_LABEL[e.category]}
                      {e.notes ? ` · ${e.notes}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tnum">
                    {fmtMoney(e.amount_cents)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {FIXED_CADENCE_LABEL[e.cadence]}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {v?.display_name ?? "—"}
                  </td>
                  <td
                    className="px-4 py-3 text-muted tnum"
                    style={{ fontSize: 12 }}
                  >
                    {e.effective_from}
                    {e.effective_to ? ` → ${e.effective_to}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        className="btn btn-ghost"
                        style={{
                          height: 30,
                          padding: "0 10px",
                          fontSize: 12,
                        }}
                        disabled={busy}
                        onClick={() => onEdit(e)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{
                          height: 30,
                          padding: "0 10px",
                          fontSize: 12,
                          color: "var(--danger)",
                        }}
                        disabled={busy}
                        onClick={() => onArchive(e)}
                      >
                        {archivedView ? "Delete" : "Archive"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Per-ride defaults card ──────────────────────────────────────
//
// 3 trip types × 4 categories editor. Trigger
// apply_ride_cost_defaults reads these and seeds ride_costs rows on
// each new ride.
const TRIP_TYPES: { id: keyof RideCostDefaults; label: string }[] = [
  { id: "airport", label: "Airport" },
  { id: "p2p", label: "Point to point" },
  { id: "hourly", label: "Hourly" },
];
const COST_CATS: { id: keyof RideCostDefaults["airport"]; label: string }[] = [
  { id: "gas", label: "Gas" },
  { id: "tolls", label: "Tolls" },
  { id: "parking", label: "Parking" },
  { id: "amenities", label: "Amenities" },
];

function RideCostDefaultsCard({
  defaults,
  onChange,
}: {
  defaults: RideCostDefaults;
  onChange: (next: RideCostDefaults) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RideCostDefaults>(defaults);

  // Pull props into local edit state when defaults change externally
  // (e.g. another tab updated them).
  useEffect(() => {
    setDraft(defaults);
  }, [defaults]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(defaults);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateOrgSettings({ ride_cost_defaults: draft });
      onChange(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-[6px] p-5 md:p-6 mb-6"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="eyebrow" style={{ letterSpacing: "0.22em" }}>
            Per-ride templates
          </p>
          <h3
            className="serif mt-1"
            style={{
              fontSize: 22,
              letterSpacing: "-0.005em",
              lineHeight: 1.1,
            }}
          >
            Default cost estimates
          </h3>
          <p className="text-muted mt-1.5" style={{ fontSize: 12.5 }}>
            When a ride is created, the trigger seeds these amounts as
            estimated lines. Owner or driver overrides them with the
            actual after the trip.
          </p>
        </div>
        {dirty ? (
          <div className="flex items-center gap-2">
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={save}
            >
              {busy ? "Saving…" : "Save defaults"}
            </button>
            <button
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setDraft(defaults)}
            >
              Reset
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full" style={{ fontSize: 13 }}>
          <thead>
            <tr
              className="text-left"
              style={{
                fontSize: 10.5,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              <th className="pb-3 pr-4">Trip type</th>
              {COST_CATS.map((c) => (
                <th
                  key={c.id}
                  className="pb-3 pr-3 text-right"
                  style={{ minWidth: 96 }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRIP_TYPES.map((t) => (
              <tr
                key={t.id}
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <td className="py-3 pr-4" style={{ fontWeight: 500 }}>
                  {t.label}
                </td>
                {COST_CATS.map((c) => {
                  const cents = draft[t.id][c.id] ?? 0;
                  return (
                    <td key={c.id} className="py-2 pr-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <span
                          className="text-muted tnum"
                          style={{ fontSize: 11 }}
                        >
                          $
                        </span>
                        <input
                          className="field tnum"
                          inputMode="decimal"
                          style={{
                            height: 32,
                            width: 82,
                            fontSize: 13,
                            textAlign: "right",
                            padding: "0 8px",
                          }}
                          value={
                            cents > 0 ? (cents / 100).toFixed(2) : ""
                          }
                          placeholder="0.00"
                          onChange={(e) => {
                            const v = parseFloat(
                              e.target.value.replace(/[^0-9.]/g, ""),
                            );
                            const newCents = Number.isFinite(v)
                              ? Math.round(v * 100)
                              : 0;
                            setDraft((prev) => ({
                              ...prev,
                              [t.id]: {
                                ...prev[t.id],
                                [c.id]: newCents,
                              },
                            }));
                          }}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error ? (
        <p
          className="text-danger mt-3"
          style={{ fontSize: 12.5 }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ── Per-ride tab ────────────────────────────────────────────────
function PerRideTab({
  rides,
  costs,
  loading,
  defaults,
  onDefaultsChange,
}: {
  rides: Ride[];
  costs: RideCost[];
  loading: boolean;
  defaults: RideCostDefaults;
  onDefaultsChange: (next: RideCostDefaults) => void;
}) {
  // Group costs by ride, then summarise per category.
  const byCategory = useMemo(() => {
    const map = new Map<
      RideCost["category"],
      { estimated: number; actual: number; count: number }
    >();
    for (const c of costs) {
      const slot = map.get(c.category) ?? {
        estimated: 0,
        actual: 0,
        count: 0,
      };
      slot.estimated += c.estimated_cents;
      slot.actual += c.actual_cents ?? c.estimated_cents;
      slot.count += 1;
      map.set(c.category, slot);
    }
    return Array.from(map.entries())
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.actual - a.actual);
  }, [costs]);

  const totalActual = byCategory.reduce((s, x) => s + x.actual, 0);
  const totalEstimated = byCategory.reduce((s, x) => s + x.estimated, 0);
  const unconfirmedCount = costs.filter(
    (c) => c.actual_cents === null,
  ).length;

  // Recent ride-cost entries with their ride.
  const ridesById = useMemo(
    () => new Map(rides.map((r) => [r.id, r])),
    [rides],
  );
  const recent = useMemo(
    () =>
      [...costs]
        .sort((a, b) => (b.added_at > a.added_at ? 1 : -1))
        .slice(0, 12),
    [costs],
  );

  return (
    <div>
      <RideCostDefaultsCard
        defaults={defaults}
        onChange={onDefaultsChange}
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div
          className="rounded-[6px] p-5"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <p className="eyebrow" style={{ letterSpacing: "0.22em" }}>
            Actual costs (90d)
          </p>
          <div
            className="serif tnum mt-1"
            style={{ fontSize: 28, letterSpacing: "-0.01em" }}
          >
            {fmtMoney(totalActual)}
          </div>
          <p
            className="text-muted mt-1"
            style={{ fontSize: 12 }}
          >
            Uses confirmed actuals; estimates fill in where actuals aren't yet entered.
          </p>
        </div>
        <div
          className="rounded-[6px] p-5"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <p className="eyebrow" style={{ letterSpacing: "0.22em" }}>
            Estimated total (90d)
          </p>
          <div
            className="serif tnum mt-1"
            style={{ fontSize: 28, letterSpacing: "-0.01em" }}
          >
            {fmtMoney(totalEstimated)}
          </div>
          <p
            className="text-muted mt-1"
            style={{ fontSize: 12 }}
          >
            {totalEstimated > 0
              ? `Variance ${fmtMoney(totalActual - totalEstimated)} so far`
              : "No estimates entered yet"}
          </p>
        </div>
        <div
          className="rounded-[6px] p-5"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <p className="eyebrow" style={{ letterSpacing: "0.22em" }}>
            Unconfirmed lines
          </p>
          <div
            className="serif tnum mt-1"
            style={{ fontSize: 28, letterSpacing: "-0.01em" }}
          >
            {unconfirmedCount}
          </div>
          <p
            className="text-muted mt-1"
            style={{ fontSize: 12 }}
          >
            Driver should fill in the actual amount after the trip.
          </p>
        </div>
      </div>

      {loading ? (
        <EmptyCard title="Loading…" body="Pulling the last 90 days of ride costs." />
      ) : costs.length === 0 ? (
        <EmptyCard
          title="No per-ride costs yet"
          body="Open a ride on /rides/:id, scroll to the Costs block, and add gas / tolls / parking estimates. Once the trip is done, fill in the actual amounts."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div
            className="rounded-[6px] p-5"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <p className="eyebrow" style={{ letterSpacing: "0.22em" }}>
              By category
            </p>
            <div className="flex flex-col mt-4">
              {byCategory.map((row, i) => {
                const pct =
                  totalActual > 0 ? (row.actual / totalActual) * 100 : 0;
                return (
                  <div
                    key={row.category}
                    className="relative flex items-center gap-3 py-3"
                    style={{
                      borderTop:
                        i === 0 ? "none" : "1px solid var(--border)",
                    }}
                  >
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0"
                      style={{
                        width: `${pct}%`,
                        background:
                          "color-mix(in oklab, var(--accent) 10%, transparent)",
                        zIndex: 0,
                      }}
                    />
                    <span
                      className="relative z-10"
                      style={{ fontSize: 13, fontWeight: 500, flex: 1 }}
                    >
                      {RIDE_COST_CATEGORY_LABEL[row.category]}
                    </span>
                    <span
                      className="relative z-10 text-muted tnum"
                      style={{ fontSize: 11.5, width: 56, textAlign: "right" }}
                    >
                      {row.count}×
                    </span>
                    <span
                      className="relative z-10 tnum"
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        width: 80,
                        textAlign: "right",
                      }}
                    >
                      {fmtMoney(row.actual)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="rounded-[6px] p-5"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <p className="eyebrow" style={{ letterSpacing: "0.22em" }}>
              Recent entries
            </p>
            <div className="flex flex-col mt-3">
              {recent.map((c, i) => {
                const ride = ridesById.get(c.ride_id);
                const confirmed = c.actual_cents !== null;
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 py-3"
                    style={{
                      borderTop:
                        i === 0 ? "none" : "1px solid var(--border)",
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/rides/${c.ride_id}`}
                        className="block truncate"
                        style={{ fontSize: 13, fontWeight: 500 }}
                      >
                        {ride?.passenger_name ?? "Unknown ride"} ·{" "}
                        {RIDE_COST_CATEGORY_LABEL[c.category]}
                      </Link>
                      <div
                        className="text-muted tnum"
                        style={{ fontSize: 11.5 }}
                      >
                        {ride
                          ? new Date(ride.pickup_at).toLocaleDateString(
                              "en-US",
                              {
                                timeZone: "America/Los_Angeles",
                                month: "short",
                                day: "numeric",
                              },
                            )
                          : "—"}
                        {c.note ? ` · ${c.note}` : ""}
                      </div>
                    </div>
                    <div
                      className="tnum shrink-0"
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        textAlign: "right",
                        color: confirmed
                          ? "var(--text)"
                          : "var(--text-muted)",
                      }}
                    >
                      {confirmed
                        ? fmtMoney(c.actual_cents!)
                        : `~${fmtMoney(c.estimated_cents)}`}
                      <div
                        className="text-muted"
                        style={{ fontSize: 10.5, fontWeight: 400 }}
                      >
                        {confirmed ? "actual" : "estimated"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Maintenance tab ─────────────────────────────────────────────
type MaintDraft = {
  id?: string;
  vehicle_id: string;
  category: MaintenanceCategory;
  label: string;
  amount: string;
  serviced_at: string;
  odometer: string;
  interval_days: string;
  notes: string;
};

function emptyMaintDraft(vehicleId: string): MaintDraft {
  return {
    vehicle_id: vehicleId,
    category: "oil",
    label: "",
    amount: "",
    serviced_at: new Date().toISOString().slice(0, 10),
    odometer: "",
    interval_days: "",
    notes: "",
  };
}

function MaintenanceTab({
  records,
  vehicles,
  onReload,
}: {
  records: VehicleMaintenance[];
  vehicles: Vehicle[];
  onReload: () => void;
}) {
  const [draft, setDraft] = useState<MaintDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Allocated to *this month*.
  const monthAllocated = useMemo(() => {
    const now = new Date();
    const from = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const to = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59),
    );
    return maintenanceAllocatedCents(records, from, to);
  }, [records]);

  const startNew = () => {
    setError(null);
    setDraft(emptyMaintDraft(vehicles[0]?.id ?? ""));
  };
  const startEdit = (m: VehicleMaintenance) => {
    setError(null);
    setDraft({
      id: m.id,
      vehicle_id: m.vehicle_id,
      category: m.category,
      label: m.label,
      amount: (m.amount_cents / 100).toString(),
      serviced_at: m.serviced_at,
      odometer: m.odometer_at_service?.toString() ?? "",
      interval_days: m.service_interval_days?.toString() ?? "",
      notes: m.notes ?? "",
    });
  };
  const save = async () => {
    if (!draft) return;
    if (!draft.vehicle_id) {
      setError("Pick a vehicle.");
      return;
    }
    if (!draft.label.trim()) {
      setError("Add a label so you remember what this is.");
      return;
    }
    const cents = Math.round(parseFloat(draft.amount || "0") * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Amount must be a positive number.");
      return;
    }
    const odo = draft.odometer ? parseInt(draft.odometer, 10) : null;
    const interval = draft.interval_days
      ? parseInt(draft.interval_days, 10)
      : null;
    setBusy(true);
    setError(null);
    try {
      await upsertMaintenance({
        ...(draft.id ? { id: draft.id } : {}),
        vehicle_id: draft.vehicle_id,
        category: draft.category,
        label: draft.label.trim(),
        amount_cents: cents,
        serviced_at: draft.serviced_at,
        odometer_at_service: odo,
        service_interval_days: interval,
        notes: draft.notes.trim() || null,
      });
      setDraft(null);
      onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (m: VehicleMaintenance) => {
    if (!confirm(`Delete "${m.label}"?`)) return;
    setBusy(true);
    try {
      await deleteMaintenance(m.id);
      onReload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <p className="eyebrow" style={{ letterSpacing: "0.22em" }}>
            This month, allocated
          </p>
          <div
            className="serif tnum mt-1"
            style={{ fontSize: 28, letterSpacing: "-0.01em" }}
          >
            {fmtMoney(monthAllocated)}
          </div>
        </div>
        {!draft && vehicles.length > 0 ? (
          <button className="btn btn-primary" onClick={startNew}>
            Log maintenance
          </button>
        ) : null}
      </div>

      {vehicles.length === 0 ? (
        <EmptyCard
          title="Add a vehicle first"
          body="Maintenance ties to a specific vehicle so it can amortize correctly. Add one in Drivers → Fleet, then come back here."
        />
      ) : null}

      {draft ? (
        <MaintenanceDraftEditor
          draft={draft}
          setDraft={setDraft}
          vehicles={vehicles}
          onCancel={() => setDraft(null)}
          onSave={save}
          busy={busy}
          error={error}
        />
      ) : null}

      {vehicles.length > 0 && records.length === 0 && !draft ? (
        <EmptyCard
          title="No service records yet"
          body="Log an oil change, tire set, brake job, registration renewal — anything that costs money to keep the car on the road. Set a service-interval-in-days to spread that cost evenly over the period it covers."
          action={
            <button className="btn btn-primary" onClick={startNew}>
              Log your first service
            </button>
          }
        />
      ) : null}

      {records.length > 0 ? (
        <MaintenanceTable
          rows={records}
          vehicles={vehicles}
          onEdit={startEdit}
          onDelete={remove}
          busy={busy}
        />
      ) : null}
    </div>
  );
}

function MaintenanceDraftEditor({
  draft,
  setDraft,
  vehicles,
  onCancel,
  onSave,
  busy,
  error,
}: {
  draft: MaintDraft;
  setDraft: (d: MaintDraft) => void;
  vehicles: Vehicle[];
  onCancel: () => void;
  onSave: () => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <div
      className="rounded-[6px] p-5 md:p-6 mb-5 fade-up"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Vehicle</label>
          <select
            className="field"
            value={draft.vehicle_id}
            onChange={(e) =>
              setDraft({ ...draft, vehicle_id: e.target.value })
            }
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.display_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Category</label>
          <select
            className="field"
            value={draft.category}
            onChange={(e) =>
              setDraft({
                ...draft,
                category: e.target.value as MaintenanceCategory,
              })
            }
          >
            {Object.entries(MAINTENANCE_CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Label</label>
          <input
            className="field"
            placeholder="Synthetic oil + filter"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Amount (USD)</label>
          <input
            className="field tnum"
            inputMode="decimal"
            placeholder="0.00"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Serviced on</label>
          <input
            type="date"
            className="field"
            value={draft.serviced_at}
            onChange={(e) =>
              setDraft({ ...draft, serviced_at: e.target.value })
            }
          />
        </div>
        <div>
          <label className="label">Odometer (optional)</label>
          <input
            className="field tnum"
            inputMode="numeric"
            placeholder="78000"
            value={draft.odometer}
            onChange={(e) => setDraft({ ...draft, odometer: e.target.value })}
          />
        </div>
        <div>
          <label className="label">
            Amortize over (days, optional)
          </label>
          <input
            className="field tnum"
            inputMode="numeric"
            placeholder="90"
            value={draft.interval_days}
            onChange={(e) =>
              setDraft({ ...draft, interval_days: e.target.value })
            }
          />
          <p className="help">
            Leave blank to count once on the service date. Otherwise the cost spreads evenly over this many days starting at the service date.
          </p>
        </div>
        <div>
          <label className="label">Notes</label>
          <input
            className="field"
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </div>
      </div>
      {error ? (
        <p className="text-danger mt-3" style={{ fontSize: 13 }}>
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-2 mt-5">
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={onSave}
        >
          {busy ? "Saving…" : draft.id ? "Save changes" : "Log service"}
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function MaintenanceTable({
  rows,
  vehicles,
  onEdit,
  onDelete,
  busy,
}: {
  rows: VehicleMaintenance[];
  vehicles: Vehicle[];
  onEdit: (m: VehicleMaintenance) => void;
  onDelete: (m: VehicleMaintenance) => void;
  busy: boolean;
}) {
  return (
    <div
      className="rounded-[6px] overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full" style={{ fontSize: 13 }}>
          <thead>
            <tr
              className="text-left"
              style={{
                fontSize: 10.5,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Interval</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => {
              const v = vehicles.find((x) => x.id === m.vehicle_id);
              return (
                <tr
                  key={m.id}
                  style={{
                    borderTop:
                      i === 0 ? "none" : "1px solid var(--border)",
                  }}
                >
                  <td className="px-4 py-3">
                    <div style={{ fontWeight: 500 }}>{m.label}</div>
                    <div
                      className="text-muted"
                      style={{ fontSize: 11.5 }}
                    >
                      {MAINTENANCE_CATEGORY_LABEL[m.category]}
                      {m.odometer_at_service
                        ? ` · ${m.odometer_at_service.toLocaleString()} mi`
                        : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tnum">
                    {fmtMoney(m.amount_cents)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {v?.display_name ?? "Unknown vehicle"}
                  </td>
                  <td
                    className="px-4 py-3 text-muted tnum"
                    style={{ fontSize: 12 }}
                  >
                    {m.serviced_at}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {m.service_interval_days
                      ? `${m.service_interval_days}d`
                      : "one-time"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        className="btn btn-ghost"
                        style={{
                          height: 30,
                          padding: "0 10px",
                          fontSize: 12,
                        }}
                        disabled={busy}
                        onClick={() => onEdit(m)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{
                          height: 30,
                          padding: "0 10px",
                          fontSize: 12,
                          color: "var(--danger)",
                        }}
                        disabled={busy}
                        onClick={() => onDelete(m)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────
export function Expenses() {
  const [tab, setTab] = useState<TabId>("fixed");
  const [fixed, setFixed] = useState<ExpenseFixed[]>([]);
  const [maintenance, setMaintenance] = useState<VehicleMaintenance[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [rideCosts, setRideCosts] = useState<RideCost[]>([]);
  const [defaults, setDefaults] = useState<RideCostDefaults>(
    EMPTY_RIDE_COST_DEFAULTS,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [fx, mt, vs, settings] = await Promise.all([
        listFixedExpenses(),
        listMaintenance(),
        listAllVehicles(),
        getOrgSettings().catch(() => null),
      ]);
      setFixed(fx);
      setMaintenance(mt);
      setVehicles(vs);
      if (settings) setDefaults(settings.ride_cost_defaults);

      // For the per-ride tab: rides + their cost rows for the trailing 90 days.
      const to = new Date();
      const from = new Date(to.getTime() - 90 * 86_400_000);
      const rs = await listRides({
        from: from.toISOString(),
        to: to.toISOString(),
        limit: 1000,
      });
      setRides(rs);
      const ids = rs.map((r) => r.id);
      const rc = ids.length > 0 ? await listRideCostsForRides(ids) : [];
      setRideCosts(rc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader />
      <TabStrip active={tab} onChange={setTab} />

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

      {tab === "fixed" ? (
        <FixedTab expenses={fixed} vehicles={vehicles} onReload={load} />
      ) : null}
      {tab === "perride" ? (
        <PerRideTab
          rides={rides}
          costs={rideCosts}
          loading={loading}
          defaults={defaults}
          onDefaultsChange={setDefaults}
        />
      ) : null}
      {tab === "maintenance" ? (
        <MaintenanceTab
          records={maintenance}
          vehicles={vehicles}
          onReload={load}
        />
      ) : null}
    </div>
  );
}
