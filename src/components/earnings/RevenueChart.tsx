// Big revenue chart for the Earnings page. Filled area for the current
// period (accent), dashed line overlay for the comparison period
// (muted), interactive crosshair on hover. SVG so we don't drag in a
// charting library for a chart this simple.

import { useMemo, useRef, useState } from "react";
import { fmtMoney, BUSINESS_TZ } from "../../lib/format";

type Point = { day: string; cents: number };

function fmtAxisMoney(cents: number): string {
  const n = cents / 100;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}m`;
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `$${Math.round(n)}`;
}

function niceMax(value: number): number {
  if (value <= 0) return 10000;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  for (const m of [1, 1.5, 2, 2.5, 5, 7.5, 10]) {
    if (m * base >= value) return m * base;
  }
  return 10 * base;
}

function fmtDayShort(day: string): string {
  const [, m, d] = day.split("-").map((s) => parseInt(s, 10));
  return `${m}/${d}`;
}

function fmtDayLong(day: string): string {
  const [y, m, d] = day.split("-").map((s) => parseInt(s, 10));
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toLocaleDateString(
    "en-US",
    {
      timeZone: BUSINESS_TZ,
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  );
}

export function EarningsRevenueChart({
  current,
  previous,
  prevLabel,
  emphasizeIncome,
}: {
  current: Point[];
  previous: Point[] | null;
  prevLabel: string;
  emphasizeIncome: boolean; // styles the legend with the right label
}) {
  const W = 1100;
  const H = 320;
  const padL = 56;
  const padR = 20;
  const padT = 16;
  const padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const peakCents = useMemo(() => {
    const all = [...current.map((p) => p.cents)];
    if (previous) all.push(...previous.map((p) => p.cents));
    return Math.max(...all, 1);
  }, [current, previous]);
  const yMax = niceMax(peakCents * 1.1);

  // Normalise previous to current.length (so a 30-day prev shows on a
  // 30-day chart even if the calendar day-count drifted).
  const prevSampled = useMemo(() => {
    if (!previous || previous.length === 0) return null;
    if (previous.length === current.length) return previous;
    return Array.from({ length: current.length }, (_, i) => {
      const ratio = current.length <= 1 ? 0 : i / (current.length - 1);
      const idx = Math.min(
        previous.length - 1,
        Math.max(0, Math.round(ratio * (previous.length - 1))),
      );
      return previous[idx];
    });
  }, [previous, current.length]);

  const xAt = (i: number) =>
    current.length <= 1
      ? padL + innerW / 2
      : padL + (i / (current.length - 1)) * innerW;
  const yAt = (cents: number) =>
    padT + innerH - (cents / yMax) * innerH;

  const curLine =
    current
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.cents)}`,
      )
      .join(" ") || "";
  const curArea =
    current.length > 0
      ? curLine +
        ` L ${xAt(current.length - 1)} ${padT + innerH}` +
        ` L ${xAt(0)} ${padT + innerH} Z`
      : "";
  const prevLine =
    prevSampled && prevSampled.length > 0
      ? prevSampled
          .map(
            (p, i) =>
              `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.cents)}`,
          )
          .join(" ")
      : "";

  const ticks = 4;
  const tickValues = Array.from(
    { length: ticks + 1 },
    (_, i) => (yMax / ticks) * i,
  );

  // X-axis labels: ~7 evenly spaced.
  const xLabels = useMemo(() => {
    const n = current.length;
    if (n === 0) return [];
    const count = Math.min(7, n);
    const idxs = Array.from({ length: count }, (_, i) =>
      Math.round((count <= 1 ? 0 : i / (count - 1)) * (n - 1)),
    );
    return idxs.map((i) => ({
      i,
      label: fmtDayShort(current[i].day),
    }));
  }, [current]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || current.length === 0) return;
    const r = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    if (x < padL || x > W - padR) {
      setHover(null);
      return;
    }
    const ratio = current.length <= 1 ? 0 : (x - padL) / innerW;
    const idx = Math.min(
      current.length - 1,
      Math.max(0, Math.round(ratio * (current.length - 1))),
    );
    setHover(idx);
  };

  const hoverPoint = hover !== null ? current[hover] : null;
  const hoverPrev =
    hover !== null && prevSampled ? prevSampled[hover] : null;

  return (
    <div
      className="rounded-[6px] p-5 md:p-6 fade-up"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
        <div>
          <p className="eyebrow" style={{ letterSpacing: "0.22em" }}>
            {emphasizeIncome ? "My income" : "Fleet revenue"}
          </p>
          <h3
            className="serif mt-1"
            style={{
              fontSize: 22,
              letterSpacing: "-0.005em",
              lineHeight: 1.1,
            }}
          >
            Over time
          </h3>
          <p
            className="text-muted mt-1.5"
            style={{ fontSize: 12.5 }}
          >
            <span
              className="inline-block align-middle mr-1.5"
              style={{
                width: 12,
                height: 2,
                background: "var(--accent)",
                verticalAlign: "middle",
              }}
            />
            Current
            {prevSampled ? (
              <>
                <span
                  className="inline-block align-middle ml-4 mr-1.5"
                  style={{
                    width: 12,
                    borderTop: "2px dashed var(--text-muted)",
                    verticalAlign: "middle",
                  }}
                />
                {prevLabel}
              </>
            ) : null}
          </p>
        </div>
        {hoverPoint ? (
          <div className="text-right">
            <p className="eyebrow" style={{ letterSpacing: "0.22em" }}>
              {fmtDayLong(hoverPoint.day)}
            </p>
            <div
              className="serif tnum mt-1"
              style={{ fontSize: 26, lineHeight: 1, letterSpacing: "-0.01em" }}
            >
              {fmtMoney(hoverPoint.cents)}
            </div>
            {hoverPrev ? (
              <div
                className="text-muted tnum mt-1"
                style={{ fontSize: 11.5 }}
              >
                prior {fmtMoney(hoverPrev.cents)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full mt-2"
        style={{ height: "auto", aspectRatio: `${W}/${H}` }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Revenue over time"
      >
        {/* gridlines + y labels */}
        {tickValues.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke="var(--border)"
              strokeDasharray={i === 0 ? "0" : "2 4"}
            />
            <text
              x={padL - 10}
              y={yAt(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fill="var(--text-muted)"
              fontSize="11"
              className="mono"
            >
              {fmtAxisMoney(t)}
            </text>
          </g>
        ))}

        {/* current period area */}
        <defs>
          <linearGradient id="earn-rev-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {curArea ? <path d={curArea} fill="url(#earn-rev-grad)" /> : null}

        {/* prev period dashed */}
        {prevLine ? (
          <path
            d={prevLine}
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="1.5"
            strokeDasharray="3 5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.7"
          />
        ) : null}

        {/* current period line on top */}
        {curLine ? (
          <path
            d={curLine}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* x labels */}
        {xLabels.map(({ i, label }) => (
          <text
            key={i}
            x={xAt(i)}
            y={H - 10}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize="11"
            className="mono"
          >
            {label}
          </text>
        ))}

        {/* hover marker */}
        {hover !== null && current[hover] ? (
          <g>
            <line
              x1={xAt(hover)}
              x2={xAt(hover)}
              y1={padT}
              y2={padT + innerH}
              stroke="var(--text-muted)"
              strokeOpacity="0.4"
              strokeDasharray="2 4"
            />
            <circle
              cx={xAt(hover)}
              cy={yAt(current[hover].cents)}
              r="5"
              fill="var(--accent)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
}
