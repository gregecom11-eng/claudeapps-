import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listRides } from "../lib/api";
import { BUSINESS_TZ, fmtMoney, fmtTime } from "../lib/format";
import { Icon } from "../components/Icon";
import { StatusBadge } from "../components/StatusBadge";
import type { Ride } from "../lib/types";

export function Calendar() {
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [rides, setRides] = useState<Ride[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const start = new Date(anchor);
    const end = new Date(anchor);
    end.setMonth(end.getMonth() + 1);
    listRides({
      from: start.toISOString(),
      to: end.toISOString(),
      limit: 500,
    })
      .then(setRides)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      );
  }, [anchor]);

  const weeks = useMemo(() => buildMonthGrid(anchor), [anchor]);
  const ridesByDay = useMemo(() => {
    const m = new Map<string, Ride[]>();
    for (const r of rides) {
      const key = laDayKey(r.pickup_at);
      m.set(key, [...(m.get(key) ?? []), r]);
    }
    for (const list of m.values()) {
      list.sort(
        (a, b) =>
          new Date(a.pickup_at).getTime() - new Date(b.pickup_at).getTime(),
      );
    }
    return m;
  }, [rides]);

  const monthLabel = anchor.toLocaleDateString("en-US", {
    timeZone: BUSINESS_TZ,
    month: "long",
    year: "numeric",
  });

  const [selected, setSelected] = useState<string | null>(null);
  const selectedRides =
    selected && ridesByDay.get(selected)
      ? ridesByDay.get(selected) ?? []
      : [];

  const todayKey = laDayKey(new Date().toISOString());

  const move = (delta: number) => {
    const d = new Date(anchor);
    d.setMonth(d.getMonth() + delta);
    setAnchor(d);
    setSelected(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div
            className="text-muted"
            style={{
              fontSize: 12.5,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Schedule
          </div>
          <h1
            className="mt-1"
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            {monthLabel}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => move(-1)}
            className="inline-grid place-items-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
            aria-label="Previous month"
          >
            <Icon name="back" size={14} />
          </button>
          <button
            onClick={() => {
              const d = new Date();
              d.setDate(1);
              d.setHours(0, 0, 0, 0);
              setAnchor(d);
              setSelected(null);
            }}
            className="inline-flex items-center justify-center h-9 px-3 rounded-[8px] text-[13px]"
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          >
            Today
          </button>
          <button
            onClick={() => move(1)}
            className="inline-grid place-items-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
            aria-label="Next month"
          >
            <Icon name="arrow" size={14} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="surface rounded-[12px] p-4 text-danger text-sm">
          {error}
        </div>
      ) : null}

      {/* Day-of-week header */}
      <div
        className="grid grid-cols-7 gap-1 text-muted"
        style={{
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-2 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day, i) => {
          const key = laDayKey(day.toISOString());
          const dayRides = ridesByDay.get(key) ?? [];
          const isCurrent = day.getMonth() === anchor.getMonth();
          const isToday = key === todayKey;
          const isSelected = key === selected;
          return (
            <button
              key={i}
              onClick={() => setSelected(isSelected ? null : key)}
              className="text-left rounded-[8px] p-2 transition"
              style={{
                background: isSelected
                  ? "color-mix(in oklab, var(--accent) 12%, var(--surface))"
                  : "var(--surface)",
                border: `1px solid ${
                  isSelected
                    ? "var(--accent)"
                    : isToday
                    ? "color-mix(in oklab, var(--accent) 50%, var(--border))"
                    : "var(--border)"
                }`,
                opacity: isCurrent ? 1 : 0.4,
                minHeight: 70,
              }}
            >
              <div
                className="flex items-center justify-between"
                style={{ fontSize: 13, fontWeight: isToday ? 700 : 500 }}
              >
                <span>{day.getDate()}</span>
                {dayRides.length > 0 ? (
                  <span
                    className="tabular text-muted"
                    style={{ fontSize: 11 }}
                  >
                    {dayRides.length}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap gap-0.5">
                {dayRides.slice(0, 5).map((r) => (
                  <span
                    key={r.id}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: dotColor(r.status),
                    }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day details */}
      {selected ? (
        <section className="surface rounded-[12px] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "-0.005em",
              }}
            >
              {prettyDay(selected)}
              <span
                className="text-muted ml-2"
                style={{ fontSize: 12.5, fontWeight: 400 }}
              >
                {selectedRides.length}{" "}
                {selectedRides.length === 1 ? "ride" : "rides"}
              </span>
            </h2>
            <button
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="inline-grid place-items-center"
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}
            >
              <Icon name="x" size={12} />
            </button>
          </div>
          {selectedRides.length === 0 ? (
            <div className="text-muted text-sm">Nothing on this day.</div>
          ) : (
            <ul className="divide-y divide-border">
              {selectedRides.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/rides/${r.id}`}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <div
                      className="tabular w-16"
                      style={{ fontSize: 13.5, fontWeight: 600 }}
                    >
                      {fmtTime(r.pickup_at)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="truncate"
                        style={{ fontSize: 13.5, fontWeight: 500 }}
                      >
                        {r.passenger_name}
                      </div>
                      <div
                        className="text-muted truncate"
                        style={{ fontSize: 12 }}
                      >
                        {r.pickup_address}
                        {r.dropoff_address ? ` → ${r.dropoff_address}` : ""}
                      </div>
                    </div>
                    {r.total_cents > 0 ? (
                      <span
                        className="tabular text-muted hidden sm:inline"
                        style={{ fontSize: 12 }}
                      >
                        {fmtMoney(r.total_cents)}
                      </span>
                    ) : null}
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

function dotColor(status: Ride["status"]): string {
  switch (status) {
    case "completed":
      return "var(--success)";
    case "cancelled":
      return "var(--danger)";
    case "in_progress":
    case "arrived":
      return "var(--accent)";
    case "on_the_way":
      return "var(--warn)";
    default:
      return "var(--text-muted)";
  }
}

function buildMonthGrid(anchor: Date): Date[][] {
  // Anchor = first day of the month; build a 6-week grid starting Monday.
  const start = new Date(anchor);
  start.setDate(1);
  // Day of week: 0 (Sun) to 6 (Sat). Convert to Monday-first: 0=Mon..6=Sun
  const dow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dow);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      week.push(day);
    }
    weeks.push(week);
  }
  return weeks;
}

function laDayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function prettyDay(key: string): string {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: BUSINESS_TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
