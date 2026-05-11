// Client portal · Trips tab.
// Upcoming / Past filter pills + a chronological list. Tapping a row
// opens the full trip detail.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listRides } from "../lib/api";
import { useRideRealtime } from "../lib/realtime";
import { Icon } from "../components/Icon";
import type { Ride } from "../lib/types";
import { TripRow } from "./Client";

type Filter = "upcoming" | "past";

export function ClientTrips() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    listRides({ limit: 500 })
      .then((r) => setRides(r))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => reload(), [reload]);
  useRideRealtime(reload);

  const now = Date.now();
  const upcoming = useMemo(
    () =>
      rides
        .filter(
          (r) =>
            new Date(r.pickup_at).getTime() >= now &&
            r.status !== "cancelled" &&
            r.status !== "completed",
        )
        .sort(
          (a, b) =>
            new Date(a.pickup_at).getTime() - new Date(b.pickup_at).getTime(),
        ),
    [rides, now],
  );
  const past = useMemo(
    () =>
      rides
        .filter(
          (r) =>
            new Date(r.pickup_at).getTime() < now ||
            r.status === "completed" ||
            r.status === "cancelled",
        )
        .sort(
          (a, b) =>
            new Date(b.pickup_at).getTime() - new Date(a.pickup_at).getTime(),
        ),
    [rides, now],
  );

  const visible = filter === "upcoming" ? upcoming : past;

  return (
    <div className="space-y-6 fade-up">
      <div>
        <p className="eyebrow mb-3">Your trips</p>
        <h1
          className="serif"
          style={{
            fontSize: "clamp(30px, 4.5vw, 40px)",
            letterSpacing: "-0.015em",
            lineHeight: 1.1,
          }}
        >
          Reservations & history
        </h1>
      </div>

      {/* Filter pills */}
      <div
        role="tablist"
        aria-label="Trip filter"
        className="inline-flex p-1 rounded-full"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
        }}
      >
        <FilterPill
          active={filter === "upcoming"}
          onClick={() => setFilter("upcoming")}
          label="Upcoming"
          count={upcoming.length}
        />
        <FilterPill
          active={filter === "past"}
          onClick={() => setFilter("past")}
          label="Past"
          count={past.length}
        />
      </div>

      {error ? (
        <div className="surface rounded-[12px] p-4 text-danger text-sm">
          {error}
        </div>
      ) : null}

      {loading && visible.length === 0 ? (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: 64, borderRadius: 12 }}
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <ul className="space-y-2.5">
          {visible.map((r) => (
            <li key={r.id}>
              <TripRow ride={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full transition active:scale-[0.97]"
      style={{
        background: active ? "var(--accent)" : "transparent",
        color: active ? "#15161B" : "var(--text-muted)",
        fontWeight: active ? 600 : 500,
        fontSize: 13,
        letterSpacing: "-0.005em",
      }}
    >
      {label}
      <span
        className="tnum"
        style={{
          fontSize: 11.5,
          opacity: active ? 0.65 : 0.8,
          fontWeight: 500,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  if (filter === "upcoming") {
    return (
      <div
        className="rounded-[14px] p-8 text-center"
        style={{
          background: "var(--surface-2)",
          border: "1px dashed var(--border-strong)",
        }}
      >
        <div
          className="mx-auto inline-grid place-items-center mb-3"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--accent)",
          }}
        >
          <Icon name="calendar" size={20} />
        </div>
        <p
          className="serif"
          style={{ fontSize: 22, letterSpacing: "-0.01em" }}
        >
          No upcoming trips.
        </p>
        <p
          className="text-muted mt-2"
          style={{ fontSize: 13.5, lineHeight: 1.5 }}
        >
          Ready when you are.
        </p>
        <Link
          to="/book"
          className="inline-flex items-center gap-1.5 mt-5 px-5 h-11 rounded-[10px] text-[14px] font-semibold"
          style={{
            background: "var(--accent)",
            color: "#15161B",
            border: "1px solid var(--accent-strong)",
          }}
        >
          <Icon name="plus" size={14} /> Book a ride
        </Link>
      </div>
    );
  }
  return (
    <div
      className="rounded-[14px] p-8 text-center"
      style={{
        background: "var(--surface-2)",
        border: "1px dashed var(--border-strong)",
      }}
    >
      <p
        className="text-muted serif"
        style={{ fontSize: 18, letterSpacing: "-0.01em" }}
      >
        Nothing here yet.
      </p>
    </div>
  );
}
