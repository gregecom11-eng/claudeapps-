import { useState } from "react";
import { Link } from "react-router-dom";
import type { Driver, Ride, Vehicle } from "../lib/types";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { StatusBadge } from "./StatusBadge";
import { fmtDateTime, fmtMoney, fmtTime } from "../lib/format";

type Props = {
  ride: Ride;
  driver?: Driver | null;
  vehicle?: Vehicle | null;
};

export function RideCard({ ride, driver, vehicle }: Props) {
  const [copied, setCopied] = useState(false);
  const isLive = ride.status === "in_progress";

  const onCopy = async () => {
    const lines = [
      `SDLuxury · Ride confirmation`,
      fmtDateTime(ride.pickup_at),
      `Passenger: ${ride.passenger_name}${
        ride.passenger_phone ? ` · ${ride.passenger_phone}` : ""
      }`,
      `Pickup:  ${ride.pickup_address}`,
      ride.dropoff_address ? `Dropoff: ${ride.dropoff_address}` : null,
      ride.flight_number
        ? `Flight:  ${ride.flight_airline ?? ""} ${ride.flight_number}${
            ride.flight_status ? ` — ${ride.flight_status}` : ""
          }`
        : null,
      driver
        ? `Driver:  ${driver.full_name}${
            vehicle ? ` · ${vehicle.display_name}` : ""
          }`
        : null,
      ride.total_cents ? `Total:   ${fmtMoney(ride.total_cents)}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard?.writeText(lines);
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <article
      className="surface rounded-[12px] shadow-card relative"
      style={{
        padding: "16px 16px 14px 16px",
        boxShadow: isLive
          ? "0 0 0 1px var(--accent), 0 8px 24px rgba(0,0,0,0.08)"
          : undefined,
        background: isLive
          ? "color-mix(in oklab, var(--accent) 6%, var(--surface))"
          : "var(--surface)",
      }}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <Link
            to={`/rides/${ride.id}`}
            className="tnum hover:text-accent transition"
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "var(--text)",
            }}
          >
            {fmtTime(ride.pickup_at)}
          </Link>
          <span
            className="text-muted tnum"
            style={{ fontSize: 12 }}
          >
            {ride.id.slice(0, 8)}
          </span>
        </div>
        <StatusBadge status={ride.status} />
      </header>

      <div className="mt-3 flex items-center gap-3">
        <Avatar name={ride.passenger_name} size={32} />
        <div className="min-w-0 flex-1">
          <Link
            to={`/rides/${ride.id}`}
            className="block truncate hover:text-accent transition"
            style={{
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {ride.passenger_name}
          </Link>
          {ride.passenger_phone ? (
            <div className="text-muted tnum" style={{ fontSize: 12.5 }}>
              {ride.passenger_phone}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="mt-3 grid gap-2"
        style={{ gridTemplateColumns: "10px 1fr" }}
      >
        <div className="flex flex-col items-center pt-1.5">
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
        <div className="flex flex-col gap-2">
          <div className="min-w-0">
            <div
              className="text-muted"
              style={{
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              Pickup
            </div>
            <div className="truncate" style={{ fontSize: 13.5 }}>
              {ride.pickup_address}
            </div>
          </div>
          {ride.dropoff_address ? (
            <div className="min-w-0">
              <div
                className="text-muted"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                Dropoff
              </div>
              <div className="truncate" style={{ fontSize: 13.5 }}>
                {ride.dropoff_address}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {ride.flight_number ? (
        <div
          className="mt-3 flex items-center gap-2.5 rounded-[8px] px-3 py-2"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <Icon name="plane" size={14} className="text-accent" />
          <div className="tnum" style={{ fontSize: 12.5 }}>
            <span style={{ fontWeight: 600 }}>
              {ride.flight_airline ?? ""} {ride.flight_number}
            </span>
            {ride.flight_status ? (
              <>
                <span className="text-muted"> · </span>
                <span style={{ color: "var(--success)" }}>
                  {ride.flight_status}
                </span>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {driver || vehicle ? (
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {driver ? (
            <div className="flex items-center gap-2 min-w-0">
              <Avatar name={driver.full_name} size={22} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                {driver.full_name}
              </span>
            </div>
          ) : null}
          {driver && vehicle ? (
            <span className="text-muted">·</span>
          ) : null}
          {vehicle ? (
            <div className="flex items-center gap-2 min-w-0 text-muted">
              <Icon name="car" size={14} />
              <span className="tnum" style={{ fontSize: 12.5 }}>
                {vehicle.display_name}
                {vehicle.plate ? ` · ${vehicle.plate}` : ""}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <footer
        className="mt-3 pt-3 flex items-center justify-between"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="flex items-baseline gap-2">
          <span
            className="text-muted"
            style={{
              fontSize: 11.5,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Total
          </span>
          <span
            className="tnum"
            style={{
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {fmtMoney(ride.total_cents)}
          </span>
        </div>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12.5px] font-medium transition"
          style={{
            background: copied
              ? "color-mix(in oklab, var(--success) 14%, transparent)"
              : "transparent",
            color: copied ? "var(--success)" : "var(--text)",
            border: `1px solid ${
              copied
                ? "color-mix(in oklab, var(--success) 40%, var(--border))"
                : "var(--border)"
            }`,
          }}
          aria-live="polite"
        >
          {copied ? (
            <>
              <Icon name="check" size={14} />
              <span className="pop-in">Copied confirmation</span>
            </>
          ) : (
            <>
              <Icon name="copy" size={14} />
              Copy confirmation
            </>
          )}
        </button>
      </footer>
    </article>
  );
}
