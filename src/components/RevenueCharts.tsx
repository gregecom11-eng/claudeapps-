// Hand-rolled SVG charts for the Earnings page. Two flavors:
//
//   <CumulativeRevenueChart>
//      A line whose path is solid up to "now" (earned cumulative) and
//      dashed beyond it (projected if every booked ride completes for
//      its quoted total). Y-axis = dollars, X-axis = day.
//
//   <DailyRevenueBars>
//      Stacked bars per day: the earned (completed) portion sits at
//      the bottom in the success color, the projected (still-on-the-
//      books) portion sits on top in amber. Hover tooltip with the
//      breakdown.
//
// Kept dependency-free on purpose: ~150 lines of SVG beats a 300KB
// charting library for a chart this simple.

import { useMemo, useState } from "react";

export type RevenuePoint = {
  day: string; // "YYYY-MM-DD" in business TZ
  earnedCents: number; // completed rides on that day
  projectedCents: number; // non-cancelled, non-completed
};

const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

function niceMax(value: number): number {
  if (value <= 0) return 100; // $1 floor so axes don't collapse
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  for (const m of [1, 2, 2.5, 5, 10]) {
    const candidate = m * base;
    if (candidate >= value) return candidate;
  }
  return 10 * base;
}

function fmtMoneyShort(cents: number): string {
  const n = cents / 100;
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtDayShort(day: string): string {
  // day = "YYYY-MM-DD" in LA tz; render as "M/D".
  const [, m, d] = day.split("-").map((s) => parseInt(s, 10));
  return `${m}/${d}`;
}

// ── Cumulative line: solid earned, dashed projected ──────────────
export function CumulativeRevenueChart({
  data,
  todayIndex, // last index that's "earned"; everything after is projected
  width = 720,
}: {
  data: RevenuePoint[];
  todayIndex: number;
  width?: number;
}) {
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const cumulative = useMemo(() => {
    let earnedTotal = 0;
    return data.map((p, i) => {
      earnedTotal += p.earnedCents;
      const projectedTotal =
        i <= todayIndex
          ? earnedTotal
          : data
              .slice(0, i + 1)
              .reduce(
                (s, x, j) =>
                  s +
                  (j <= todayIndex
                    ? x.earnedCents
                    : x.earnedCents + x.projectedCents),
                0,
              );
      return { earned: earnedTotal, projected: projectedTotal };
    });
  }, [data, todayIndex]);

  const peak =
    cumulative.length === 0
      ? 0
      : Math.max(...cumulative.map((c) => c.projected));
  const yMax = niceMax(peak);

  const x = (i: number) =>
    data.length <= 1
      ? PAD.left + innerW / 2
      : PAD.left + (i / (data.length - 1)) * innerW;
  const y = (cents: number) =>
    PAD.top + innerH - (cents / yMax) * innerH;

  // Earned path: from index 0 to todayIndex, using cumulative.earned.
  const earnedPath = cumulative
    .slice(0, Math.max(0, todayIndex + 1))
    .map((c, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(c.earned)}`)
    .join(" ");

  // Projected path: continues from (todayIndex, earned-at-today) onwards
  // using cumulative.projected.
  const projectedPath =
    todayIndex >= 0 && todayIndex < cumulative.length - 1
      ? [
          `M ${x(todayIndex)} ${y(cumulative[todayIndex].earned)}`,
          ...cumulative
            .slice(todayIndex + 1)
            .map((c, i) => `L ${x(todayIndex + 1 + i)} ${y(c.projected)}`),
        ].join(" ")
      : "";

  // Y-axis ticks at 0 / 25 / 50 / 75 / 100% of yMax.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);

  // X-axis labels: keep it readable — at most ~6 labels.
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label="Cumulative revenue"
      >
        {/* Grid + Y labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={PAD.left + innerW}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--border)"
              strokeDasharray={i === 0 ? "0" : "2 4"}
            />
            <text
              x={PAD.left - 8}
              y={y(t) + 4}
              fontSize="10"
              textAnchor="end"
              fill="var(--text-muted)"
              className="tnum"
            >
              {fmtMoneyShort(t)}
            </text>
          </g>
        ))}

        {/* X labels */}
        {data.map((p, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <text
              key={p.day}
              x={x(i)}
              y={HEIGHT - PAD.bottom + 16}
              fontSize="10"
              textAnchor="middle"
              fill="var(--text-muted)"
              className="tnum"
            >
              {fmtDayShort(p.day)}
            </text>
          ) : null,
        )}

        {/* Today marker */}
        {todayIndex >= 0 && todayIndex < data.length ? (
          <line
            x1={x(todayIndex)}
            x2={x(todayIndex)}
            y1={PAD.top}
            y2={PAD.top + innerH}
            stroke="var(--text-muted)"
            strokeOpacity="0.4"
            strokeDasharray="2 3"
          />
        ) : null}

        {/* Projected (drawn first so earned line is on top) */}
        {projectedPath ? (
          <path
            d={projectedPath}
            fill="none"
            stroke="var(--warn)"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
        ) : null}

        {/* Earned */}
        {earnedPath ? (
          <path
            d={earnedPath}
            fill="none"
            stroke="var(--success)"
            strokeWidth="2.25"
          />
        ) : null}

        {/* Earned endpoint dot */}
        {todayIndex >= 0 && todayIndex < cumulative.length ? (
          <circle
            cx={x(todayIndex)}
            cy={y(cumulative[todayIndex].earned)}
            r="3.5"
            fill="var(--success)"
          />
        ) : null}
      </svg>
      <Legend
        items={[
          { color: "var(--success)", label: "Earned" },
          { color: "var(--warn)", label: "Projected", dashed: true },
        ]}
      />
    </div>
  );
}

// ── Stacked bars per day: earned + projected ─────────────────────
export function DailyRevenueBars({
  data,
  width = 720,
}: {
  data: RevenuePoint[];
  width?: number;
}) {
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const peak =
    data.length === 0
      ? 0
      : Math.max(
          ...data.map((p) => p.earnedCents + p.projectedCents),
        );
  const yMax = niceMax(peak);

  const slotW = data.length > 0 ? innerW / data.length : 0;
  const barW = Math.max(2, Math.min(28, slotW * 0.6));

  const y = (cents: number) =>
    PAD.top + innerH - (cents / yMax) * innerH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  const [hover, setHover] = useState<number | null>(null);

  return (
    <div style={{ width: "100%", overflow: "hidden", position: "relative" }}>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label="Revenue by day"
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid + Y labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={PAD.left + innerW}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--border)"
              strokeDasharray={i === 0 ? "0" : "2 4"}
            />
            <text
              x={PAD.left - 8}
              y={y(t) + 4}
              fontSize="10"
              textAnchor="end"
              fill="var(--text-muted)"
              className="tnum"
            >
              {fmtMoneyShort(t)}
            </text>
          </g>
        ))}

        {data.map((p, i) => {
          const cx = PAD.left + slotW * (i + 0.5);
          const earnedH = (p.earnedCents / yMax) * innerH;
          const projectedH = (p.projectedCents / yMax) * innerH;
          const earnedY = PAD.top + innerH - earnedH;
          const projectedY = earnedY - projectedH;
          const isHover = hover === i;
          return (
            <g
              key={p.day}
              onMouseEnter={() => setHover(i)}
              onMouseMove={() => setHover(i)}
            >
              {/* Hit target (full slot height) */}
              <rect
                x={cx - slotW / 2}
                y={PAD.top}
                width={slotW}
                height={innerH}
                fill="transparent"
              />
              {p.projectedCents > 0 ? (
                <rect
                  x={cx - barW / 2}
                  y={projectedY}
                  width={barW}
                  height={projectedH}
                  fill="var(--warn)"
                  opacity={isHover ? 0.95 : 0.78}
                  rx={2}
                />
              ) : null}
              {p.earnedCents > 0 ? (
                <rect
                  x={cx - barW / 2}
                  y={earnedY}
                  width={barW}
                  height={earnedH}
                  fill="var(--success)"
                  opacity={isHover ? 1 : 0.92}
                  rx={2}
                />
              ) : null}
              {i % labelEvery === 0 || i === data.length - 1 ? (
                <text
                  x={cx}
                  y={HEIGHT - PAD.bottom + 16}
                  fontSize="10"
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  className="tnum"
                >
                  {fmtDayShort(p.day)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hover !== null && data[hover] ? (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${
              ((PAD.left + slotW * (hover + 0.5)) / width) * 100
            }%`,
            top: 4,
            transform: "translateX(-50%)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 11.5,
            boxShadow:
              "0 4px 14px color-mix(in oklab, #000 12%, transparent)",
            whiteSpace: "nowrap",
          }}
        >
          <div className="tnum" style={{ fontWeight: 600 }}>
            {fmtDayShort(data[hover].day)}
          </div>
          <div className="text-muted tnum" style={{ fontSize: 11 }}>
            <span style={{ color: "var(--success)" }}>
              {fmtMoneyShort(data[hover].earnedCents)} earned
            </span>
            {data[hover].projectedCents > 0 ? (
              <>
                {" · "}
                <span style={{ color: "var(--warn)" }}>
                  {fmtMoneyShort(data[hover].projectedCents)} booked
                </span>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <Legend
        items={[
          { color: "var(--success)", label: "Earned" },
          { color: "var(--warn)", label: "Booked, not yet completed" },
        ]}
      />
    </div>
  );
}

function Legend({
  items,
}: {
  items: { color: string; label: string; dashed?: boolean }[];
}) {
  return (
    <div
      className="flex items-center gap-4 mt-1 px-1"
      style={{ fontSize: 11.5 }}
    >
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span
            style={{
              display: "inline-block",
              width: 14,
              height: 2,
              background: it.dashed ? "transparent" : it.color,
              borderTop: it.dashed ? `2px dashed ${it.color}` : undefined,
            }}
          />
          <span className="text-muted">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
