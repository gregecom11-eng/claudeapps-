// Forecast scenario knobs. Lets the operator toy with what adding a
// driver, lifting prices, or upping marketing would do to annualized
// revenue. Uses the actual window-to-annual run rate as the baseline.

import { useState } from "react";
import { fmtMoney } from "../../lib/format";
import { Delta } from "./atoms";

export function EarningsForecast({
  windowMyIncomeCents,
  windowDays,
}: {
  windowMyIncomeCents: number;
  windowDays: number;
}) {
  const [extraDrivers, setExtraDrivers] = useState(0);
  const [priceLift, setPriceLift] = useState(0);
  const [marketingK, setMarketingK] = useState(0);

  // Run-rate annualization. If window is 0 days (shouldn't happen) fall
  // back to a sane minimum.
  const annualizationFactor =
    windowDays > 0 ? 365 / windowDays : 0;
  const baseAnnual = windowMyIncomeCents * annualizationFactor;

  // Heuristic per-driver contribution: 50 weeks × 18 rides × $260 avg ×
  // 50% owner share at a future commission rate. Order-of-magnitude
  // only — the slider is for "what does another driver feel like"
  // rather than a hard forecast.
  const driverAnnualContributionCents = 50 * 18 * 26000 * 0.5;

  const newAnnual =
    baseAnnual *
      (1 + priceLift / 100) *
      (1 + 0.02 * marketingK) +
    extraDrivers * driverAnnualContributionCents;

  const lift = baseAnnual > 0 ? (newAnnual - baseAnnual) / baseAnnual : null;

  return (
    <div
      className="rounded-[6px] p-5 md:p-6 fade-up"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <p className="eyebrow" style={{ letterSpacing: "0.22em" }}>
        Scenario planning
      </p>
      <h3
        className="serif mt-1"
        style={{
          fontSize: 22,
          letterSpacing: "-0.005em",
          lineHeight: 1.1,
        }}
      >
        Play with the{" "}
        <span style={{ fontStyle: "italic", color: "var(--accent)" }}>
          knobs
        </span>
      </h3>
      <p
        className="text-muted mt-1.5"
        style={{ fontSize: 12.5 }}
      >
        See what staffing, price, and marketing changes would mean for the
        year — built off your current run-rate.
      </p>

      <div className="grid gap-5 mt-6 sm:grid-cols-3">
        <Knob
          label="Add drivers"
          value={extraDrivers}
          onChange={setExtraDrivers}
          min={0}
          max={3}
          step={1}
          suffix={extraDrivers === 1 ? "driver" : "drivers"}
        />
        <Knob
          label="Price adjustment"
          value={priceLift}
          onChange={setPriceLift}
          min={-10}
          max={20}
          step={1}
          suffix="%"
        />
        <Knob
          label="Marketing / month"
          value={marketingK}
          onChange={setMarketingK}
          min={0}
          max={5}
          step={1}
          suffix="k"
          prefix="$"
        />
      </div>

      <div
        className="grid sm:grid-cols-3 gap-6 mt-7 pt-6"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div>
          <div className="eyebrow" style={{ letterSpacing: "0.22em" }}>
            Today, annualized
          </div>
          <div
            className="serif tnum mt-1"
            style={{ fontSize: 28, letterSpacing: "-0.01em" }}
          >
            {fmtMoney(baseAnnual)}
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{ letterSpacing: "0.22em" }}>
            Scenario
          </div>
          <div
            className="serif tnum mt-1"
            style={{
              fontSize: 28,
              letterSpacing: "-0.01em",
              color:
                lift === null
                  ? "var(--text)"
                  : lift > 0
                    ? "var(--success)"
                    : lift < 0
                      ? "var(--danger)"
                      : "var(--text)",
            }}
          >
            {fmtMoney(newAnnual)}
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{ letterSpacing: "0.22em" }}>
            Change
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span
              className="serif tnum"
              style={{
                fontSize: 28,
                letterSpacing: "-0.01em",
                color:
                  lift === null
                    ? "var(--text-muted)"
                    : lift > 0
                      ? "var(--success)"
                      : lift < 0
                        ? "var(--danger)"
                        : "var(--text)",
              }}
            >
              {lift === null
                ? "—"
                : `${lift >= 0 ? "+" : ""}${(lift * 100).toFixed(1)}%`}
            </span>
            <Delta value={lift} suffix="" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Knob({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  prefix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  prefix?: string;
}) {
  const renderVal = (v: number) =>
    `${prefix ?? ""}${v}${suffix ? (suffix === "%" ? suffix : ` ${suffix}`) : ""}`;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="eyebrow" style={{ letterSpacing: "0.22em" }}>
          {label}
        </span>
        <span
          className="tnum"
          style={{ fontSize: 14, fontWeight: 500 }}
        >
          {renderVal(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full"
        style={{ accentColor: "var(--accent)" }}
      />
      <div
        className="flex justify-between mt-1 text-muted tnum"
        style={{ fontSize: 10.5 }}
      >
        <span>{renderVal(min)}</span>
        <span>{renderVal(max)}</span>
      </div>
    </div>
  );
}
