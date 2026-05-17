// Small atoms used across the Earnings page panels: delta pill,
// sparkline, KPI card, and the date-controls bar. Visual language from
// the dispatch-101 design handoff, but tinted via CSS variables so the
// same components look correct in both dark and light themes.

import { Icon } from "../Icon";
import type { PeriodId } from "./period";

// ── Delta pill ───────────────────────────────────────────────────
export function Delta({
  value,
  suffix = "vs prev",
}: {
  value: number | null | undefined;
  suffix?: string;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return (
      <span
        className="inline-flex items-center gap-1 tnum"
        style={{
          fontSize: 11.5,
          padding: "2px 8px",
          borderRadius: 999,
          color: "var(--text-muted)",
          background: "var(--surface-2)",
          fontWeight: 500,
        }}
      >
        — {suffix}
      </span>
    );
  }
  const up = value >= 0.005;
  const down = value <= -0.005;
  const color = up
    ? "var(--success)"
    : down
      ? "var(--danger)"
      : "var(--text-muted)";
  const tint = up
    ? "color-mix(in oklab, var(--success) 12%, transparent)"
    : down
      ? "color-mix(in oklab, var(--danger) 12%, transparent)"
      : "var(--surface-2)";
  const sign = value >= 0 ? "+" : "";
  return (
    <span
      className="inline-flex items-center gap-1 tnum"
      style={{
        fontSize: 11.5,
        padding: "2px 8px",
        borderRadius: 999,
        color,
        background: tint,
        fontWeight: 500,
      }}
    >
      <span style={{ fontSize: 10, lineHeight: 1 }}>
        {up ? "▲" : down ? "▼" : "·"}
      </span>
      {sign}
      {(value * 100).toFixed(1)}%
      {suffix ? (
        <span
          className="text-muted"
          style={{ marginLeft: 4, fontWeight: 400, fontSize: 11 }}
        >
          {suffix}
        </span>
      ) : null}
    </span>
  );
}

// ── Sparkline ────────────────────────────────────────────────────
export function Sparkline({
  values,
  color = "var(--accent)",
  height = 28,
  width = 84,
}: {
  values: number[];
  color?: string;
  height?: number;
  width?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const lastY =
    height - ((values[values.length - 1] - min) / span) * (height - 4) - 2;
  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible"
      aria-hidden
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={width} cy={lastY} r="2.2" fill={color} />
    </svg>
  );
}

// ── KPI card ─────────────────────────────────────────────────────
// `accent` flips the card to an inverted (text-color background, bg-color
// text) version that "pops" against the rest of the row in both themes.
export function EarningsKpi({
  label,
  value,
  delta,
  hint,
  spark,
  sparkColor,
  accent = false,
}: {
  label: string;
  value: string;
  delta?: number | null;
  hint?: string;
  spark?: number[];
  sparkColor?: string;
  accent?: boolean;
}) {
  const bg = accent ? "var(--text)" : "var(--surface)";
  const fg = accent ? "var(--bg)" : "var(--text)";
  const muted = accent
    ? "color-mix(in oklab, var(--bg) 65%, var(--text))"
    : "var(--text-muted)";
  const border = accent ? "var(--text)" : "var(--border)";
  const sparkColorResolved = accent
    ? "var(--accent)"
    : (sparkColor ?? "var(--accent)");

  return (
    <div
      className="rounded-[6px] p-5 md:p-6 flex flex-col fade-up"
      style={{
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        minHeight: 148,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className="eyebrow"
          style={{
            color: muted,
            letterSpacing: "0.22em",
          }}
        >
          {label}
        </p>
        {spark && spark.some((v) => v > 0) ? (
          <Sparkline values={spark} color={sparkColorResolved} />
        ) : null}
      </div>
      <div className="mt-3">
        <div
          className="serif tnum"
          style={{
            fontSize: 38,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: fg,
          }}
        >
          {value}
        </div>
      </div>
      {delta !== undefined ? (
        <div className="mt-2">
          <Delta value={delta} />
        </div>
      ) : null}
      {hint ? (
        <div
          className="mt-auto pt-3"
          style={{ fontSize: 12, color: muted }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

// ── Date controls ────────────────────────────────────────────────
const PERIOD_CHIPS: { id: PeriodId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "p90d", label: "90d" },
  { id: "ytd", label: "YTD" },
  { id: "p12m", label: "12m" },
];

export type CompareMode = "prev" | "yoy" | "none";

export function EarningsDateControls({
  periodId,
  setPeriodId,
  compareMode,
  setCompareMode,
}: {
  periodId: PeriodId;
  setPeriodId: (id: PeriodId) => void;
  compareMode: CompareMode;
  setCompareMode: (m: CompareMode) => void;
}) {
  return (
    <div
      className="rounded-[6px] p-3 md:p-4 flex items-center justify-between gap-3 flex-wrap"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="flex items-center gap-1.5 flex-wrap"
        role="tablist"
        aria-label="Period"
      >
        {PERIOD_CHIPS.map((c) => {
          const active = c.id === periodId;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={active}
              onClick={() => setPeriodId(c.id)}
              className="inline-flex items-center justify-center transition"
              style={{
                height: 32,
                padding: "0 14px",
                borderRadius: 4,
                fontSize: 12.5,
                fontWeight: 500,
                letterSpacing: "0.02em",
                border: `1px solid ${active ? "var(--text)" : "var(--border)"}`,
                background: active ? "var(--text)" : "var(--surface)",
                color: active ? "var(--bg)" : "var(--text-muted)",
                whiteSpace: "nowrap",
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <span className="eyebrow hidden sm:inline" style={{ fontSize: 10 }}>
          <Icon name="swap" size={11} /> Compare
        </span>
        <select
          value={compareMode}
          onChange={(e) => setCompareMode(e.target.value as CompareMode)}
          className="field"
          style={{ height: 32, fontSize: 12.5, paddingRight: 28, width: 168 }}
        >
          <option value="prev">Previous period</option>
          <option value="yoy">Same period last year</option>
          <option value="none">— no comparison</option>
        </select>
      </div>
    </div>
  );
}
