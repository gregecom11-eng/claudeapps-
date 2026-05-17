// Service-mix donut: how revenue split across airport / point-to-point /
// hourly. Reads from inferTripType() until an explicit trip_type column
// lands on the rides table.

import { fmtMoney } from "../../lib/format";
import { TRIP_TYPE_LABEL, type TripType } from "../../lib/earnings";

const COLORS: Record<TripType, string> = {
  airport: "var(--accent)",
  hourly: "var(--accent-strong)",
  p2p: "color-mix(in oklab, var(--accent) 60%, var(--text-muted))",
  other: "var(--text-muted)",
};

export function EarningsServiceMix({
  buckets,
  heading = "By service type",
  eyebrow = "Revenue mix",
}: {
  buckets: Record<TripType, number>;
  heading?: string;
  eyebrow?: string;
}) {
  const order: TripType[] = ["airport", "p2p", "hourly", "other"];
  const total = order.reduce((s, k) => s + buckets[k], 0);

  const r = 60;
  const c = r + 14;
  const dash = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div
      className="rounded-[6px] p-5 md:p-6 fade-up"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <p className="eyebrow" style={{ letterSpacing: "0.22em" }}>
        {eyebrow}
      </p>
      <h3
        className="serif mt-1"
        style={{ fontSize: 22, letterSpacing: "-0.005em", lineHeight: 1.1 }}
      >
        {heading}
      </h3>

      {total === 0 ? (
        <div
          className="mt-5 rounded-[6px] p-5 text-center text-muted"
          style={{
            background: "var(--surface-2)",
            border: "1px dashed var(--border)",
            fontSize: 13,
          }}
        >
          No revenue in this window yet.
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-6 flex-wrap">
          <svg
            width={c * 2}
            height={c * 2}
            className="shrink-0"
            aria-hidden
          >
            <g transform={`rotate(-90 ${c} ${c})`}>
              {order.map((k) => {
                if (buckets[k] === 0) return null;
                const len = (buckets[k] / total) * dash;
                const off = -acc;
                acc += len;
                return (
                  <circle
                    key={k}
                    cx={c}
                    cy={c}
                    r={r}
                    fill="none"
                    stroke={COLORS[k]}
                    strokeWidth="18"
                    strokeDasharray={`${len} ${dash}`}
                    strokeDashoffset={off}
                  />
                );
              })}
            </g>
            <text
              x={c}
              y={c - 4}
              textAnchor="middle"
              fontFamily="Cormorant Garamond"
              fontSize="20"
              fontWeight={500}
              fill="var(--text)"
            >
              {fmtMoney(total)}
            </text>
            <text
              x={c}
              y={c + 14}
              textAnchor="middle"
              fontSize="10"
              letterSpacing="0.18em"
              fill="var(--text-muted)"
            >
              TOTAL
            </text>
          </svg>

          <div className="flex-1 flex flex-col gap-2.5 min-w-[180px]">
            {order.map((k) => {
              if (buckets[k] === 0 && total > 0) return null;
              const pct = total > 0 ? Math.round((buckets[k] / total) * 100) : 0;
              return (
                <div key={k} className="flex items-center gap-3">
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: COLORS[k],
                      flexShrink: 0,
                    }}
                  />
                  <span
                    className="flex-1 truncate"
                    style={{ fontSize: 13 }}
                  >
                    {TRIP_TYPE_LABEL[k]}
                  </span>
                  <span
                    className="tnum text-muted"
                    style={{ fontSize: 12 }}
                  >
                    {pct}%
                  </span>
                  <span
                    className="tnum"
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      width: 80,
                      textAlign: "right",
                    }}
                  >
                    {fmtMoney(buckets[k])}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
