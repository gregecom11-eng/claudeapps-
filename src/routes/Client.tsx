// Client portal · Home tab.
// Shows the rider their next ride as a hero card, plus quick links and a
// peek at recent trips. The full list lives on /trips, full ride view on
// /trips/:id (also reachable from notification deep-links via /rides/:id).

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { getMyRideDetails, listRides } from "../lib/api";
import { useRideRealtime } from "../lib/realtime";
import { BUSINESS_TZ, fmtTime } from "../lib/format";
import { Icon } from "../components/Icon";
import type { Ride } from "../lib/types";
import type { ClientShellCtx } from "../components/ClientShell";

export function Client() {
  const { client } = useOutletContext<ClientShellCtx>();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    listRides({ limit: 200 })
      .then((r) => setRides(r))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

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

  const next = upcoming[0];
  const firstName = (client.name ?? "").split(/\s+/)[0];

  return (
    <div className="space-y-9 md:space-y-12 fade-up">
      <div>
        <p className="eyebrow mb-3">Your account</p>
        <h1
          className="serif"
          style={{
            fontSize: "clamp(36px, 5vw, 48px)",
            letterSpacing: "-0.015em",
            lineHeight: 1.05,
          }}
        >
          Welcome back, {firstName || "friend"}.
        </h1>
        {client.company ? (
          <p className="text-muted mt-2" style={{ fontSize: 14 }}>
            {client.company}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="surface rounded-[12px] p-4 text-danger text-sm">
          {error}
        </div>
      ) : null}

      {/* Hero — next ride */}
      {loading && !next ? (
        <div
          className="surface rounded-[16px] p-6"
          style={{ background: "var(--surface-2)" }}
        >
          <div className="skeleton" style={{ height: 14, width: 80, borderRadius: 4 }} />
          <div className="skeleton mt-4" style={{ height: 36, borderRadius: 6 }} />
          <div className="skeleton mt-5" style={{ height: 18, borderRadius: 4 }} />
          <div className="skeleton mt-2" style={{ height: 18, borderRadius: 4 }} />
        </div>
      ) : next ? (
        <NextRideHero ride={next} />
      ) : (
        <NoRidesYet />
      )}

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <QuickAction
          to="/book"
          icon="plus"
          label="Book a ride"
          hint="New reservation"
          accent
        />
        <QuickAction
          to="/trips"
          icon="calendar"
          label="All trips"
          hint={`${upcoming.length} upcoming · ${past.length} past`}
        />
      </div>

      {/* Other upcoming */}
      {upcoming.length > 1 ? (
        <section>
          <SectionHeader title="Also upcoming" to="/trips" />
          <ul className="space-y-2.5">
            {upcoming.slice(1, 4).map((r) => (
              <li key={r.id}>
                <TripRow ride={r} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Recent trips */}
      {past.length > 0 ? (
        <section>
          <SectionHeader title="Recent trips" to="/trips" />
          <ul className="space-y-2.5">
            {past.slice(0, 4).map((r) => (
              <li key={r.id}>
                <TripRow ride={r} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div
        className="text-center pt-5"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <p
          className="text-muted serif"
          style={{ fontSize: 16, fontStyle: "italic" }}
        >
          Anything else, just text. — Sergio
        </p>
      </div>
    </div>
  );
}

function NoRidesYet() {
  return (
    <div
      className="rounded-[16px] p-6 md:p-8 text-center"
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
        <Icon name="car" size={20} />
      </div>
      <p
        className="serif"
        style={{ fontSize: 22, letterSpacing: "-0.01em", lineHeight: 1.2 }}
      >
        No reservations on the books.
      </p>
      <p className="text-muted mt-2" style={{ fontSize: 13.5 }}>
        Book a ride below — Sergio will confirm within the hour.
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

function NextRideHero({ ride }: { ride: Ride }) {
  const [chauffeur, setChauffeur] = useState<{
    name: string | null;
    vehicle: string | null;
  } | null>(null);

  useEffect(() => {
    if (!ride.driver_id && !ride.vehicle_id) {
      setChauffeur(null);
      return;
    }
    let cancelled = false;
    getMyRideDetails(ride.id)
      .then((d) => {
        if (cancelled) return;
        setChauffeur(
          d
            ? {
                name: d.driver_full_name,
                vehicle: d.vehicle_display_name,
              }
            : null,
        );
      })
      .catch(() => {
        if (!cancelled) setChauffeur(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ride.id, ride.driver_id, ride.vehicle_id]);

  return (
    <Link
      to={`/trips/${ride.id}`}
      className="block rounded-[16px] overflow-hidden hero-wash transition active:scale-[0.995]"
      style={{ boxShadow: "var(--shadow-md)" }}
    >
      <div className="p-6 md:p-8">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Your next ride</p>
          <StatusPill status={ride.status} />
        </div>
        <h2
          className="display-num mt-3"
          style={{
            fontSize: "clamp(40px, 8vw, 60px)",
          }}
        >
          {fmtTime(ride.pickup_at)}
        </h2>
        <p
          className="text-muted mt-1"
          style={{ fontSize: 14, letterSpacing: "0.01em" }}
        >
          {fmtDayInLA(ride.pickup_at)}
        </p>

        <div
          className="mt-5 grid gap-2"
          style={{ gridTemplateColumns: "10px 1fr", fontSize: 14 }}
        >
          <div className="flex flex-col items-center pt-1.5">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "var(--text-muted)",
                border: "2px solid var(--surface)",
                boxShadow: "0 0 0 1px var(--border)",
              }}
            />
            <span
              style={{
                width: 1,
                flex: 1,
                background: "var(--border)",
                marginTop: 4,
                marginBottom: 4,
              }}
            />
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: "var(--accent)",
              }}
            />
          </div>
          <div className="space-y-3 min-w-0">
            <div className="min-w-0">
              <div className="eyebrow">Pickup</div>
              <div className="truncate mt-0.5">{ride.pickup_address}</div>
            </div>
            {ride.dropoff_address ? (
              <div className="min-w-0">
                <div className="eyebrow">Dropoff</div>
                <div className="truncate mt-0.5">{ride.dropoff_address}</div>
              </div>
            ) : null}
          </div>
        </div>

        {(ride.flight_airline || ride.flight_number) ? (
          <div
            className="mt-5 inline-flex items-center gap-2 rounded-[10px] px-3 py-1.5"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              fontSize: 12.5,
            }}
          >
            <Icon name="plane" size={13} className="text-accent" />
            <span className="tnum">
              {ride.flight_airline ?? ""} {ride.flight_number}
              {ride.flight_status ? ` · ${ride.flight_status}` : ""}
            </span>
          </div>
        ) : null}

        {chauffeur && (chauffeur.name || chauffeur.vehicle) ? (
          <div
            className="mt-5 rounded-[12px] p-3.5 flex items-center gap-3"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <span
              className="inline-grid place-items-center"
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--accent)",
              }}
            >
              <Icon name="car" size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="eyebrow">Chauffeur</div>
              <div
                className="truncate"
                style={{ fontSize: 14, fontWeight: 500, marginTop: 1 }}
              >
                {chauffeur.name ?? "Being assigned"}
                {chauffeur.vehicle ? (
                  <span className="text-muted">
                    {" · "}
                    {chauffeur.vehicle}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div
          className="mt-6 flex items-center justify-between gap-2"
          style={{ color: "var(--accent)" }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            View trip
          </span>
          <Icon name="arrow" size={14} />
        </div>
      </div>
    </Link>
  );
}

function QuickAction({
  to,
  icon,
  label,
  hint,
  accent,
}: {
  to: string;
  icon: "plus" | "calendar";
  label: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <Link
      to={to}
      className="rounded-[12px] p-4 flex items-center gap-3 transition active:scale-[0.985]"
      style={{
        background: accent
          ? "color-mix(in oklab, var(--accent) 12%, var(--surface))"
          : "var(--surface)",
        border: `1px solid ${
          accent
            ? "color-mix(in oklab, var(--accent) 35%, var(--border))"
            : "var(--border)"
        }`,
      }}
    >
      <span
        className="inline-grid place-items-center shrink-0"
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: accent ? "var(--accent)" : "var(--surface-2)",
          color: accent ? "#15161B" : "var(--text)",
          border: accent ? "none" : "1px solid var(--border)",
        }}
      >
        <Icon name={icon} size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div className="text-muted" style={{ fontSize: 12 }}>
          {hint}
        </div>
      </div>
      <Icon name="arrow" size={14} className="text-muted shrink-0" />
    </Link>
  );
}

export function TripRow({ ride }: { ride: Ride }) {
  return (
    <Link
      to={`/trips/${ride.id}`}
      className="block rounded-[12px] p-3.5 transition active:scale-[0.99]"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="tabular w-[68px] shrink-0">
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              letterSpacing: "-0.005em",
            }}
          >
            {fmtDayInLA(ride.pickup_at, "short")}
          </div>
          <div className="text-muted" style={{ fontSize: 11.5 }}>
            {fmtTime(ride.pickup_at)}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="truncate"
            style={{ fontSize: 13.5, lineHeight: 1.4 }}
          >
            {ride.pickup_address}
            {ride.dropoff_address ? (
              <>
                {" "}
                <span className="text-muted">→</span> {ride.dropoff_address}
              </>
            ) : null}
          </div>
          <div className="text-muted mt-0.5" style={{ fontSize: 11.5 }}>
            {prettyStatus(ride.status)}
          </div>
        </div>
        <Icon name="chev" size={14} className="text-muted shrink-0" />
      </div>
    </Link>
  );
}

function SectionHeader({ title, to }: { title: string; to?: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h2
        className="serif"
        style={{ fontSize: 22, letterSpacing: "-0.01em" }}
      >
        {title}
      </h2>
      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      {to ? (
        <Link
          to={to}
          className="text-muted hover:text-text"
          style={{ fontSize: 12, fontWeight: 500 }}
        >
          See all
        </Link>
      ) : null}
    </div>
  );
}

export function StatusPill({ status }: { status: Ride["status"] }) {
  const meta = statusMeta(status);
  return (
    <span
      className="chip"
      style={{
        background: meta.bg,
        color: meta.fg,
        border: `1px solid ${meta.border}`,
        fontWeight: 600,
        letterSpacing: "0.01em",
      }}
    >
      {meta.live ? (
        <span
          aria-hidden
          className="pulse-dot"
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: meta.fg,
          }}
        />
      ) : null}
      {meta.label}
    </span>
  );
}

function statusMeta(s: Ride["status"]): {
  label: string;
  fg: string;
  bg: string;
  border: string;
  live: boolean;
} {
  switch (s) {
    case "requested":
      return {
        label: "Awaiting confirmation",
        fg: "var(--warn)",
        bg: "color-mix(in oklab, var(--warn) 14%, var(--surface))",
        border: "color-mix(in oklab, var(--warn) 30%, var(--border))",
        live: false,
      };
    case "scheduled":
      return {
        label: "Confirmed",
        fg: "var(--text)",
        bg: "var(--surface-2)",
        border: "var(--border)",
        live: false,
      };
    case "on_the_way":
      return {
        label: "On the way",
        fg: "var(--success)",
        bg: "color-mix(in oklab, var(--success) 14%, var(--surface))",
        border: "color-mix(in oklab, var(--success) 35%, var(--border))",
        live: true,
      };
    case "arrived":
      return {
        label: "Driver arrived",
        fg: "var(--accent)",
        bg: "color-mix(in oklab, var(--accent) 18%, var(--surface))",
        border: "color-mix(in oklab, var(--accent) 45%, var(--border))",
        live: true,
      };
    case "in_progress":
      return {
        label: "On board",
        fg: "var(--accent)",
        bg: "color-mix(in oklab, var(--accent) 14%, var(--surface))",
        border: "color-mix(in oklab, var(--accent) 35%, var(--border))",
        live: true,
      };
    case "completed":
      return {
        label: "Completed",
        fg: "var(--text-muted)",
        bg: "var(--surface-2)",
        border: "var(--border)",
        live: false,
      };
    case "cancelled":
      return {
        label: "Cancelled",
        fg: "var(--danger)",
        bg: "color-mix(in oklab, var(--danger) 12%, var(--surface))",
        border: "color-mix(in oklab, var(--danger) 30%, var(--border))",
        live: false,
      };
  }
}

export function prettyStatus(s: Ride["status"]): string {
  return statusMeta(s).label;
}

export function fmtDayInLA(
  iso: string,
  mode: "long" | "short" = "long",
): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: BUSINESS_TZ,
    weekday: mode === "long" ? "long" : "short",
    month: "short",
    day: "numeric",
  });
}
