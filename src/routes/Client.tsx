// Client portal home — Kevin Morgan / Loreine / etc. log in here.
// They see their next ride (hero), upcoming reservations, past trips.
// RLS scopes everything to client_id = current_client_id().

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { claimClientByEmail, listRides } from "../lib/api";
import { useAuth } from "../lib/auth";
import { BUSINESS_TZ, fmtMoney, fmtTime } from "../lib/format";
import { Icon } from "../components/Icon";
import type { Client, Ride } from "../lib/types";

export function Client() {
  const { session } = useAuth();
  const [linked, setLinked] = useState<Client | null | "loading">("loading");
  const [rides, setRides] = useState<Ride[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    claimClientByEmail()
      .then((c) => {
        if (!cancelled) setLinked(c);
      })
      .catch((e) => {
        if (!cancelled) {
          setLinked(null);
          setError(e instanceof Error ? e.message : "Linking failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (linked === "loading") return;
    listRides({ limit: 100 })
      .then((r) =>
        setRides(
          r.sort(
            (a, b) =>
              new Date(b.pickup_at).getTime() -
              new Date(a.pickup_at).getTime(),
          ),
        ),
      )
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      );
  }, [linked]);

  if (linked === "loading") {
    return <div className="text-muted">Loading…</div>;
  }

  if (!linked) {
    return (
      <div className="space-y-4">
        <h1
          className="serif"
          style={{
            fontSize: 32,
            letterSpacing: "-0.015em",
            lineHeight: 1.1,
          }}
        >
          You're signed in.
        </h1>
        <div
          className="surface rounded-[12px] p-5 text-sm space-y-3"
          style={{ lineHeight: 1.6 }}
        >
          <p>
            We don't have a client account on file for this email yet.
            Please reach out to Sergio so he can add you. Once added,
            refresh this page and your bookings will appear.
          </p>
          <code
            className="block rounded-[8px] px-3 py-2"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              fontSize: 13,
              wordBreak: "break-all",
            }}
          >
            {session?.user?.email}
          </code>
        </div>
        {error ? <div className="text-danger text-sm">{error}</div> : null}
      </div>
    );
  }

  const now = Date.now();
  const upcoming = useMemoSorted(
    rides.filter(
      (r) =>
        new Date(r.pickup_at).getTime() >= now &&
        r.status !== "cancelled" &&
        r.status !== "completed",
    ),
    "asc",
  );
  const past = useMemoSorted(
    rides.filter(
      (r) =>
        new Date(r.pickup_at).getTime() < now ||
        r.status === "completed" ||
        r.status === "cancelled",
    ),
    "desc",
  );
  const next = upcoming[0];

  const firstName = (linked.name ?? "").split(/\s+/)[0];

  return (
    <div className="space-y-10 md:space-y-14">
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
        {linked.company ? (
          <p
            className="text-muted mt-2"
            style={{ fontSize: 14 }}
          >
            {linked.company}
            {linked.default_billing
              ? ` · ${prettyBilling(linked.default_billing)} terms`
              : ""}
          </p>
        ) : null}
      </div>

      {/* Hero — next ride */}
      {next ? (
        <NextRideHero ride={next} />
      ) : (
        <div
          className="surface rounded-[12px] p-6 text-center"
          style={{ background: "var(--surface-2)" }}
        >
          <p className="text-muted" style={{ fontSize: 14 }}>
            No reservations on the books. To book a new ride, head to{" "}
            <Link to="/book" className="text-accent">
              /book
            </Link>{" "}
            or text Sergio.
          </p>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 1 ? (
        <section>
          <SectionHeader title="Other upcoming" />
          <ul className="space-y-3">
            {upcoming.slice(1, 4).map((r) => (
              <li key={r.id}>
                <RideRow ride={r} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Past */}
      {past.length > 0 ? (
        <section>
          <SectionHeader title="Recent trips" />
          <ul className="space-y-3">
            {past.slice(0, 6).map((r) => (
              <li key={r.id}>
                <RideRow ride={r} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div
        className="text-center pt-4"
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

function useMemoSorted(rides: Ride[], dir: "asc" | "desc"): Ride[] {
  return useMemo(
    () =>
      rides
        .slice()
        .sort(
          (a, b) =>
            (dir === "asc" ? 1 : -1) *
            (new Date(a.pickup_at).getTime() -
              new Date(b.pickup_at).getTime()),
        ),
    [rides, dir],
  );
}

function NextRideHero({ ride }: { ride: Ride }) {
  return (
    <article
      className="rounded-[14px] overflow-hidden"
      style={{
        background: "color-mix(in oklab, var(--accent) 10%, var(--surface))",
        border: "1px solid color-mix(in oklab, var(--accent) 30%, var(--border))",
      }}
    >
      <div className="p-6 md:p-8">
        <p className="eyebrow mb-3">Your next ride</p>
        <h2
          className="serif"
          style={{
            fontSize: "clamp(26px, 3.5vw, 32px)",
            letterSpacing: "-0.015em",
            lineHeight: 1.15,
          }}
        >
          {fmtDayInLA(ride.pickup_at)} ·{" "}
          <span style={{ fontStyle: "italic", color: "var(--accent)" }}>
            {fmtTime(ride.pickup_at)}
          </span>
        </h2>
        <div
          className="mt-4 grid gap-2 sm:grid-cols-[10px_1fr]"
          style={{ fontSize: 14 }}
        >
          <div className="hidden sm:flex flex-col items-center pt-1.5">
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: "var(--text-muted)",
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
                width: 7,
                height: 7,
                borderRadius: 1,
                background: "var(--accent)",
              }}
            />
          </div>
          <div className="space-y-2 min-w-0">
            <div className="min-w-0">
              <div className="eyebrow">Pickup</div>
              <div className="truncate">{ride.pickup_address}</div>
            </div>
            {ride.dropoff_address ? (
              <div className="min-w-0">
                <div className="eyebrow">Dropoff</div>
                <div className="truncate">{ride.dropoff_address}</div>
              </div>
            ) : null}
          </div>
        </div>
        {ride.flight_number || ride.flight_airline ? (
          <div
            className="mt-4 inline-flex items-center gap-2 rounded-[8px] px-3 py-1.5"
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
      </div>
    </article>
  );
}

function RideRow({ ride }: { ride: Ride }) {
  return (
    <div
      className="rounded-[10px] p-4 flex items-center gap-3"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="tabular w-20 shrink-0" style={{ fontSize: 13 }}>
        <div style={{ fontWeight: 600 }}>
          {fmtDayInLA(ride.pickup_at, "short")}
        </div>
        <div className="text-muted" style={{ fontSize: 11.5 }}>
          {fmtTime(ride.pickup_at)}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate" style={{ fontSize: 13.5 }}>
          {ride.pickup_address}
          {ride.dropoff_address ? (
            <>
              {" "}
              <span className="text-muted">→</span> {ride.dropoff_address}
            </>
          ) : null}
        </div>
        <div
          className="text-muted"
          style={{ fontSize: 11.5 }}
        >
          {prettyStatus(ride.status)}
          {ride.total_cents > 0 && ride.status === "completed"
            ? ` · ${fmtMoney(ride.total_cents)}`
            : ""}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2
        className="serif"
        style={{ fontSize: 22, letterSpacing: "-0.01em" }}
      >
        {title}
      </h2>
      <div
        className="flex-1 h-px"
        style={{ background: "var(--border)" }}
      />
    </div>
  );
}

function fmtDayInLA(iso: string, mode: "long" | "short" = "long"): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: BUSINESS_TZ,
    weekday: mode === "long" ? "long" : "short",
    month: "short",
    day: "numeric",
  });
}

function prettyStatus(s: Ride["status"]): string {
  switch (s) {
    case "requested":
      return "Awaiting confirmation";
    case "scheduled":
      return "Confirmed";
    case "on_the_way":
      return "Driver on the way";
    case "arrived":
      return "Driver at pickup";
    case "in_progress":
      return "On board";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

function prettyBilling(b: string): string {
  switch (b) {
    case "net_15":
      return "Net 15";
    case "net_30":
      return "Net 30";
    case "company_billing":
      return "Company-billed";
    default:
      return b;
  }
}

