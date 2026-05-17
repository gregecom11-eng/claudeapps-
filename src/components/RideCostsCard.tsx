// Estimated-vs-actual costs for a single ride. Owner and the assigned
// driver can both add lines and fill in actual amounts; the owner can
// also delete. Two columns per line: what we thought it would cost and
// what it actually cost — variance is the difference.
//
// The card renders both as a working surface and as a tally: total
// estimated, total actual, projected profit (ride.total − costs).

import { useEffect, useMemo, useState } from "react";
import {
  deleteRideCost,
  listRideCosts,
  upsertRideCost,
} from "../lib/api";
import { fmtMoney } from "../lib/format";
import {
  RIDE_COST_CATEGORY_LABEL,
  rideCostActualCents,
  rideCostEstimatedCents,
} from "../lib/expenses";
import type { RideCost, RideCostCategory } from "../lib/types";
import { Icon } from "./Icon";

type Draft = {
  category: RideCostCategory;
  estimated: string;
  actual: string;
  note: string;
};

const EMPTY_DRAFT: Draft = {
  category: "gas",
  estimated: "",
  actual: "",
  note: "",
};

function parseCents(value: string): number | null {
  const n = parseFloat(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function RideCostsCard({
  rideId,
  rideTotalCents,
}: {
  rideId: string;
  rideTotalCents: number;
}) {
  const [costs, setCosts] = useState<RideCost[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-row inline editor for "actual" — keyed by cost id.
  const [actualDrafts, setActualDrafts] = useState<Record<string, string>>(
    {},
  );

  const reload = () => {
    listRideCosts(rideId)
      .then((cs) => {
        setCosts(cs);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId]);

  const estimated = rideCostEstimatedCents(costs);
  const actual = rideCostActualCents(costs);
  const variance = actual - estimated;
  const projectedProfit = rideTotalCents - actual;

  const allConfirmed = useMemo(
    () => costs.length > 0 && costs.every((c) => c.actual_cents !== null),
    [costs],
  );

  const saveNew = async () => {
    const estCents = parseCents(draft.estimated) ?? 0;
    const actCents =
      draft.actual.trim().length > 0 ? parseCents(draft.actual) : null;
    if (estCents <= 0 && actCents === null) {
      setError("Enter an estimated or actual amount.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await upsertRideCost({
        ride_id: rideId,
        category: draft.category,
        estimated_cents: estCents,
        actual_cents: actCents,
        note: draft.note.trim() || null,
      });
      setDraft(EMPTY_DRAFT);
      setAdding(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  const confirmActual = async (cost: RideCost) => {
    const value = actualDrafts[cost.id] ?? "";
    const cents = parseCents(value);
    if (cents === null || cents < 0) {
      setError("Enter a valid amount.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await upsertRideCost({
        id: cost.id,
        ride_id: cost.ride_id,
        category: cost.category,
        estimated_cents: cost.estimated_cents,
        actual_cents: cents,
      });
      setActualDrafts((s) => {
        const copy = { ...s };
        delete copy[cost.id];
        return copy;
      });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (cost: RideCost) => {
    if (
      !confirm(
        `Delete the ${RIDE_COST_CATEGORY_LABEL[cost.category]} cost line?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await deleteRideCost(cost.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="surface rounded-[12px]">
      <header
        className="px-5 py-4 flex items-center justify-between gap-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <h3 style={{ fontSize: 14.5, fontWeight: 600 }}>
            Costs · estimated vs actual
          </h3>
          <p
            className="text-muted mt-0.5"
            style={{ fontSize: 12, lineHeight: 1.5 }}
          >
            Add gas, tolls, parking, or amenities. Estimate up-front, fill
            in the actual amount after the trip.
          </p>
        </div>
        {!adding ? (
          <button
            className="btn btn-ghost"
            style={{ height: 32, fontSize: 12 }}
            disabled={busy}
            onClick={() => {
              setAdding(true);
              setError(null);
            }}
          >
            <Icon name="plus" size={13} />
            Add cost
          </button>
        ) : null}
      </header>

      {adding ? (
        <div
          className="px-5 py-4 fade-up"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Category</label>
              <select
                className="field"
                value={draft.category}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    category: e.target.value as RideCostCategory,
                  })
                }
              >
                {Object.entries(RIDE_COST_CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Estimated (USD)</label>
              <input
                className="field tnum"
                inputMode="decimal"
                placeholder="0.00"
                value={draft.estimated}
                onChange={(e) =>
                  setDraft({ ...draft, estimated: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Actual (optional, USD)</label>
              <input
                className="field tnum"
                inputMode="decimal"
                placeholder="Fill in after the trip"
                value={draft.actual}
                onChange={(e) =>
                  setDraft({ ...draft, actual: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Note (optional)</label>
              <input
                className="field"
                value={draft.note}
                onChange={(e) =>
                  setDraft({ ...draft, note: e.target.value })
                }
                placeholder="e.g. premium fuel"
              />
            </div>
          </div>
          {error ? (
            <p
              className="text-danger mt-2"
              style={{ fontSize: 12.5 }}
            >
              {error}
            </p>
          ) : null}
          <div className="flex items-center gap-2 mt-4">
            <button
              className="btn btn-primary"
              style={{ height: 36, fontSize: 13 }}
              disabled={busy}
              onClick={saveNew}
            >
              {busy ? "Saving…" : "Add cost"}
            </button>
            <button
              className="btn btn-ghost"
              style={{ height: 36, fontSize: 13 }}
              disabled={busy}
              onClick={() => {
                setAdding(false);
                setDraft(EMPTY_DRAFT);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {!loaded ? (
        <div className="px-5 py-6 text-muted text-sm">Loading costs…</div>
      ) : costs.length === 0 ? (
        <div className="px-5 py-6 text-muted text-sm">
          No costs entered yet. Estimating ahead is the fastest way to
          know whether a ride is profitable.
        </div>
      ) : (
        <ul>
          {costs.map((c, i) => {
            const confirmed = c.actual_cents !== null;
            const editingActual = actualDrafts[c.id] !== undefined;
            return (
              <li
                key={c.id}
                className="px-5 py-3.5 flex items-center gap-3 flex-wrap"
                style={{
                  borderTop:
                    i === 0 ? "none" : "1px solid var(--border)",
                }}
              >
                <div className="flex-1 min-w-0">
                  <div
                    style={{ fontSize: 13.5, fontWeight: 500 }}
                  >
                    {RIDE_COST_CATEGORY_LABEL[c.category]}
                    {confirmed ? (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 10.5,
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          padding: "1px 6px",
                          borderRadius: 3,
                          color: "var(--success)",
                          background:
                            "color-mix(in oklab, var(--success) 10%, transparent)",
                          fontWeight: 600,
                        }}
                      >
                        Confirmed
                      </span>
                    ) : (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 10.5,
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          padding: "1px 6px",
                          borderRadius: 3,
                          color: "var(--warn)",
                          background:
                            "color-mix(in oklab, var(--warn) 12%, transparent)",
                          fontWeight: 600,
                        }}
                      >
                        Estimate
                      </span>
                    )}
                  </div>
                  {c.note ? (
                    <div
                      className="text-muted"
                      style={{ fontSize: 11.5, marginTop: 2 }}
                    >
                      {c.note}
                    </div>
                  ) : null}
                </div>

                <div className="text-right tnum">
                  <div
                    className="text-muted"
                    style={{ fontSize: 11 }}
                  >
                    est. {fmtMoney(c.estimated_cents)}
                  </div>
                  <div
                    style={{ fontSize: 14, fontWeight: 500 }}
                  >
                    {confirmed
                      ? fmtMoney(c.actual_cents!)
                      : "—"}
                  </div>
                </div>

                {editingActual ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      className="field tnum"
                      style={{ width: 96, height: 32, fontSize: 13 }}
                      inputMode="decimal"
                      placeholder="$0.00"
                      value={actualDrafts[c.id]}
                      onChange={(e) =>
                        setActualDrafts((s) => ({
                          ...s,
                          [c.id]: e.target.value,
                        }))
                      }
                    />
                    <button
                      className="btn btn-primary"
                      style={{
                        height: 32,
                        padding: "0 10px",
                        fontSize: 12,
                      }}
                      disabled={busy}
                      onClick={() => confirmActual(c)}
                    >
                      Save
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{
                        height: 32,
                        padding: "0 10px",
                        fontSize: 12,
                      }}
                      disabled={busy}
                      onClick={() =>
                        setActualDrafts((s) => {
                          const copy = { ...s };
                          delete copy[c.id];
                          return copy;
                        })
                      }
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      className="btn btn-ghost"
                      style={{
                        height: 32,
                        padding: "0 10px",
                        fontSize: 12,
                      }}
                      onClick={() =>
                        setActualDrafts((s) => ({
                          ...s,
                          [c.id]:
                            c.actual_cents !== null
                              ? (c.actual_cents / 100).toFixed(2)
                              : "",
                        }))
                      }
                    >
                      {confirmed ? "Edit actual" : "Confirm actual"}
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{
                        height: 32,
                        padding: "0 10px",
                        fontSize: 12,
                        color: "var(--danger)",
                      }}
                      disabled={busy}
                      onClick={() => remove(c)}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer totals */}
      {costs.length > 0 ? (
        <div
          className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 tnum"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <FooterStat label="Estimated total" value={fmtMoney(estimated)} />
          <FooterStat
            label={allConfirmed ? "Actual total" : "Actual (est. fallback)"}
            value={fmtMoney(actual)}
          />
          <FooterStat
            label="Variance"
            value={`${variance >= 0 ? "+" : ""}${fmtMoney(variance)}`}
            color={
              variance > 0
                ? "var(--danger)"
                : variance < 0
                  ? "var(--success)"
                  : undefined
            }
          />
          <FooterStat
            label="Projected profit"
            value={fmtMoney(projectedProfit)}
            color={
              projectedProfit < 0
                ? "var(--danger)"
                : "var(--accent)"
            }
            big
          />
        </div>
      ) : null}
    </article>
  );
}

function FooterStat({
  label,
  value,
  color,
  big = false,
}: {
  label: string;
  value: string;
  color?: string;
  big?: boolean;
}) {
  return (
    <div>
      <div
        className="text-muted"
        style={{
          fontSize: 10.5,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        className="mt-1"
        style={{
          fontSize: big ? 18 : 15,
          fontWeight: 600,
          color: color ?? "var(--text)",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
    </div>
  );
}
