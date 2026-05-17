// Client portal · single trip view.
// Reached via /trips/:id or /rides/:id (the latter is the URL that push
// notifications use, so deep-linking from "Driver on the way" pings lands
// the rider here).

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getInvoiceForRide,
  getMyRideDetails,
  getOrgSettings,
  getRide,
  listRideEvents,
  updateRideStatus,
} from "../lib/api";
import { useRideRealtime } from "../lib/realtime";
import { confirm, pushToast } from "../components/Notify";
import { BUSINESS_TZ, fmtMoney, fmtTime } from "../lib/format";
import { Icon } from "../components/Icon";
import type {
  ActivityEvent,
  Invoice,
  Ride,
  RideStatus,
} from "../lib/types";
import { StatusPill, fmtDayInLA, prettyStatus } from "./Client";

const TIMELINE: RideStatus[] = [
  "scheduled",
  "on_the_way",
  "arrived",
  "in_progress",
  "completed",
];

const TIMELINE_LABELS: Record<RideStatus, string> = {
  requested: "Requested",
  scheduled: "Confirmed",
  on_the_way: "On the way",
  arrived: "Driver arrived",
  in_progress: "On board",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function ClientTripDetail() {
  const { id } = useParams<{ id: string }>();
  const [ride, setRide] = useState<Ride | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [chauffeur, setChauffeur] = useState<{
    driver_full_name: string | null;
    driver_phone: string | null;
    vehicle_display_name: string | null;
    vehicle_color: string | null;
    vehicle_plate: string | null;
  } | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispatchPhone, setDispatchPhone] = useState<string | null>(null);
  const [dispatchEmail, setDispatchEmail] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!id) return;
    setError(null);
    Promise.all([
      getRide(id),
      listRideEvents(id),
      getMyRideDetails(id),
      getInvoiceForRide(id).catch(() => null),
    ])
      .then(([r, ev, det, inv]) => {
        setRide(r);
        setEvents(ev);
        setChauffeur(det);
        setInvoice(inv);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => reload(), [reload]);

  useEffect(() => {
    getOrgSettings()
      .then((s) => {
        setDispatchPhone(s.dispatch_phone ?? null);
        setDispatchEmail(s.dispatch_email ?? null);
      })
      .catch(() => {
        /* not fatal */
      });
  }, []);

  useRideRealtime(reload);

  // Map RideStatus → most-recent timestamp from events.message for that
  // transition. The trigger writes "status: scheduled→on_the_way" style
  // strings on update; older events use "ride: created". Best-effort.
  const statusTimestamps = useMemo(
    () => buildStatusTimestamps(events, ride),
    [events, ride],
  );

  if (loading) {
    return (
      <div className="space-y-4 fade-up">
        <div className="skeleton" style={{ height: 18, width: 100, borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 44, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 200, borderRadius: 14 }} />
        <div className="skeleton" style={{ height: 110, borderRadius: 14 }} />
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="surface rounded-[14px] p-6 text-sm">
          We couldn't find that trip. It may have been removed.
        </div>
        {error ? <div className="text-danger text-sm">{error}</div> : null}
      </div>
    );
  }

  const cancellable = canCancel(ride);

  return (
    <div className="space-y-7 fade-up">
      <BackLink />

      {/* Hero */}
      <div>
        <p className="eyebrow mb-3">Your ride</p>
        <h1
          className="serif"
          style={{
            fontSize: "clamp(28px, 4.5vw, 38px)",
            letterSpacing: "-0.015em",
            lineHeight: 1.1,
          }}
        >
          {fmtDayInLA(ride.pickup_at)}
        </h1>
        <div className="mt-2 flex items-baseline gap-3 flex-wrap">
          <div
            className="display-num"
            style={{ fontSize: "clamp(34px, 7vw, 48px)" }}
          >
            {fmtTime(ride.pickup_at)}
          </div>
          <StatusPill status={ride.status} />
        </div>
      </div>

      {/* Status timeline */}
      {ride.status !== "cancelled" ? (
        <section
          className="rounded-[14px] p-5"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <p className="eyebrow mb-4">Progress</p>
          <ol className="space-y-3.5">
            {TIMELINE.map((step, i) => {
              const state = stepState(ride.status, step);
              const ts = statusTimestamps[step];
              return (
                <li
                  key={step}
                  className="flex items-center gap-3"
                  style={{ opacity: state === "pending" ? 0.55 : 1 }}
                >
                  <span
                    className="inline-grid place-items-center shrink-0"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      background:
                        state === "done"
                          ? "var(--accent)"
                          : state === "current"
                          ? "color-mix(in oklab, var(--accent) 22%, var(--surface-2))"
                          : "var(--surface-2)",
                      border:
                        state === "current"
                          ? "1px solid var(--accent)"
                          : "1px solid var(--border)",
                      color: state === "done" ? "#15161B" : "var(--text-muted)",
                      boxShadow:
                        state === "current"
                          ? "0 0 0 4px color-mix(in oklab, var(--accent) 18%, transparent)"
                          : "none",
                    }}
                  >
                    {state === "done" ? <Icon name="check" size={11} /> : null}
                    {state === "current" ? (
                      <span
                        className="pulse-dot"
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 999,
                          background: "var(--accent)",
                        }}
                      />
                    ) : null}
                  </span>
                  <div className="flex-1 min-w-0 flex items-baseline justify-between gap-3">
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: state === "current" ? 600 : 500,
                      }}
                    >
                      {TIMELINE_LABELS[step]}
                      {step === TIMELINE[i] && i === 0 && !ts ? (
                        <span
                          className="text-muted ml-2"
                          style={{ fontSize: 11.5, fontWeight: 400 }}
                        >
                          — pending
                        </span>
                      ) : null}
                    </span>
                    {ts ? (
                      <span
                        className="text-muted tabular"
                        style={{ fontSize: 12 }}
                      >
                        {fmtTime(ts)}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : (
        <section
          className="rounded-[14px] p-5"
          style={{
            background:
              "color-mix(in oklab, var(--danger) 10%, var(--surface))",
            border:
              "1px solid color-mix(in oklab, var(--danger) 30%, var(--border))",
          }}
        >
          <p className="eyebrow mb-1">Cancelled</p>
          <p style={{ fontSize: 13.5, lineHeight: 1.55 }}>
            This trip was cancelled. Reach out to Sergio if this looks wrong.
          </p>
        </section>
      )}

      {/* Pickup / dropoff */}
      <section className="space-y-3">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: "10px minmax(0, 1fr)" }}
        >
          <div className="flex flex-col items-center pt-1.5">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "var(--text-muted)",
                border: "2px solid var(--bg)",
                boxShadow: "0 0 0 1px var(--border)",
              }}
            />
            <span
              style={{
                width: 1,
                flex: 1,
                minHeight: 28,
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
              <div style={{ fontSize: 15, lineHeight: 1.45, marginTop: 1 }}>
                {ride.pickup_address}
              </div>
            </div>
            {ride.dropoff_address ? (
              <div className="min-w-0">
                <div className="eyebrow">Dropoff</div>
                <div style={{ fontSize: 15, lineHeight: 1.45, marginTop: 1 }}>
                  {ride.dropoff_address}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Flight — opens a Google search for the flight number in a new
          tab so riders can tap the chip to confirm status. */}
      {ride.flight_airline || ride.flight_number ? (
        <a
          href={buildFlightSearchUrl(ride.flight_airline, ride.flight_number)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-[12px] p-4 flex items-center gap-3 transition active:scale-[0.99]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <span
            className="inline-grid place-items-center shrink-0"
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--accent)",
            }}
          >
            <Icon name="plane" size={16} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="eyebrow">Flight</div>
            <div className="tnum" style={{ fontSize: 14, marginTop: 1 }}>
              {ride.flight_airline ?? ""} {ride.flight_number}
              {ride.flight_status ? (
                <span className="text-muted"> · {ride.flight_status}</span>
              ) : null}
            </div>
          </div>
          <span
            className="text-muted shrink-0 inline-flex items-center gap-1"
            style={{
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Check
            <Icon name="arrow" size={11} />
          </span>
        </a>
      ) : null}

      {/* Chauffeur card */}
      <section>
        <p className="eyebrow mb-3">Your chauffeur</p>
        {chauffeur && (chauffeur.driver_full_name || chauffeur.vehicle_display_name) ? (
          <div
            className="rounded-[14px] p-5"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="flex items-center gap-3.5">
              <span
                className="inline-grid place-items-center shrink-0"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background:
                    "linear-gradient(135deg, color-mix(in oklab, var(--accent) 22%, var(--surface-2)), var(--surface-2))",
                  border: "1px solid var(--border)",
                  color: "var(--accent)",
                }}
              >
                <Icon name="user" size={20} />
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="serif"
                  style={{
                    fontSize: 20,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.1,
                  }}
                >
                  {chauffeur.driver_full_name ?? "Being assigned"}
                </div>
                {chauffeur.vehicle_display_name ? (
                  <div
                    className="text-muted mt-1"
                    style={{ fontSize: 13 }}
                  >
                    {chauffeur.vehicle_display_name}
                    {chauffeur.vehicle_color
                      ? ` · ${chauffeur.vehicle_color}`
                      : ""}
                    {chauffeur.vehicle_plate ? (
                      <>
                        {" · "}
                        <span className="tnum">{chauffeur.vehicle_plate}</span>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            {chauffeur.driver_phone &&
            (ride.status === "on_the_way" ||
              ride.status === "arrived" ||
              ride.status === "in_progress") ? (
              <a
                href={`tel:${cleanPhone(chauffeur.driver_phone)}`}
                className="mt-4 inline-flex items-center justify-center gap-2 w-full h-12 rounded-[10px] font-semibold transition active:scale-[0.98]"
                style={{
                  background: "var(--accent)",
                  color: "#15161B",
                  border: "1px solid var(--accent-strong)",
                  fontSize: 14.5,
                }}
              >
                <Icon name="phone" size={15} /> Call {chauffeur.driver_full_name?.split(/\s+/)[0] ?? "chauffeur"}
              </a>
            ) : null}
          </div>
        ) : (
          <div
            className="rounded-[14px] p-5 text-muted"
            style={{
              background: "var(--surface-2)",
              border: "1px dashed var(--border-strong)",
              fontSize: 13.5,
              lineHeight: 1.55,
            }}
          >
            Sergio will assign a chauffeur shortly. You'll get a push the
            moment your driver is on the way.
          </div>
        )}
      </section>

      {/* Fare breakdown for completed rides */}
      {ride.status === "completed" && ride.total_cents > 0 ? (
        <section
          className="rounded-[14px] p-5"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <p className="eyebrow mb-3">Receipt</p>
          <FareRow label="Fare" cents={ride.fare_cents} />
          {ride.gratuity_cents > 0 ? (
            <FareRow label="Gratuity" cents={ride.gratuity_cents} />
          ) : null}
          {ride.parking_cents > 0 ? (
            <FareRow label="Parking & tolls" cents={ride.parking_cents} />
          ) : null}
          <div
            className="mt-3 pt-3 flex items-baseline justify-between"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <span style={{ fontSize: 14, fontWeight: 600 }}>Total</span>
            <span
              className="display-num"
              style={{ fontSize: 22 }}
            >
              {fmtMoney(ride.total_cents)}
            </span>
          </div>
        </section>
      ) : null}

      {/* Invoice (only when one's been issued for this trip) */}
      {invoice ? (
        <section
          className="rounded-[14px] p-5"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow mb-1.5">Invoice</p>
              <div
                className="tnum"
                style={{ fontSize: 16, fontWeight: 600 }}
              >
                #{invoice.number ?? invoice.id.slice(0, 8)}
              </div>
              <div className="text-muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                {invoice.due_date
                  ? invoice.status === "paid"
                    ? `Paid${invoice.paid_at ? ` ${new Date(invoice.paid_at).toLocaleDateString("en-US", { timeZone: BUSINESS_TZ, month: "short", day: "numeric" })}` : ""}`
                    : `Due ${invoice.due_date}`
                  : "Paid at time of ride"}
              </div>
            </div>
            <div className="text-right">
              <div
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: 3,
                  fontWeight: 600,
                  display: "inline-block",
                  color:
                    invoice.status === "paid"
                      ? "var(--success)"
                      : invoice.status === "overdue" ||
                          (invoice.status === "sent" &&
                            invoice.due_date &&
                            invoice.due_date < new Date().toISOString().slice(0, 10))
                        ? "var(--danger)"
                        : "var(--accent)",
                  background:
                    invoice.status === "paid"
                      ? "color-mix(in oklab, var(--success) 12%, transparent)"
                      : invoice.status === "overdue" ||
                          (invoice.status === "sent" &&
                            invoice.due_date &&
                            invoice.due_date < new Date().toISOString().slice(0, 10))
                        ? "color-mix(in oklab, var(--danger) 12%, transparent)"
                        : "color-mix(in oklab, var(--accent) 12%, transparent)",
                }}
              >
                {invoice.status === "sent" &&
                invoice.due_date &&
                invoice.due_date < new Date().toISOString().slice(0, 10)
                  ? "overdue"
                  : invoice.status}
              </div>
              <div
                className="display-num mt-2"
                style={{ fontSize: 22 }}
              >
                {fmtMoney(invoice.amount_cents)}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Dispatch contact */}
      <section>
        <p className="eyebrow mb-3">Need anything?</p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {dispatchPhone ? (
            <ContactButton
              href={`tel:${cleanPhone(dispatchPhone)}`}
              icon="phone"
              primary="Call dispatch"
              secondary={dispatchPhone}
            />
          ) : null}
          {dispatchPhone ? (
            <ContactButton
              href={`sms:${cleanPhone(dispatchPhone)}?body=${encodeURIComponent(
                buildSmsBody(ride),
              )}`}
              icon="note"
              primary="Text dispatch"
              secondary="Quick changes"
            />
          ) : null}
          {!dispatchPhone && dispatchEmail ? (
            <ContactButton
              href={`mailto:${dispatchEmail}`}
              icon="info"
              primary="Email dispatch"
              secondary={dispatchEmail}
            />
          ) : null}
        </div>
      </section>

      {/* Share trip — kept visible since sharing is a positive action. */}
      <div className="pt-2">
        <ShareButton ride={ride} />
      </div>

      {error ? (
        <div className="text-danger text-sm">{error}</div>
      ) : null}

      <div className="pt-2">
        <Link
          to="/trips"
          className="text-muted hover:text-text inline-flex items-center gap-1.5"
          style={{ fontSize: 13 }}
        >
          <Icon name="back" size={13} /> All trips
        </Link>
      </div>

      {/* Cancel is a destructive action — tucked at the very bottom in a
          muted treatment so it's findable but hard to mis-tap. The
          confirm dialog adds a second-tap safety net. */}
      {cancellable ? (
        <div
          className="pt-10 mt-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            onClick={async () => {
              const ok = await confirm({
                title: "Cancel this ride?",
                body: "Sergio will be notified. You can rebook anytime.",
                confirmLabel: "Yes, cancel ride",
                cancelLabel: "Keep it",
                destructive: true,
              });
              if (!ok) return;
              try {
                await updateRideStatus(ride.id, "cancelled");
                pushToast("success", "Ride cancelled.");
                reload();
              } catch (e) {
                pushToast(
                  "error",
                  e instanceof Error ? e.message : "Couldn't cancel",
                );
              }
            }}
            className="text-muted hover:text-text inline-flex items-center gap-1.5"
            style={{
              fontSize: 12.5,
              letterSpacing: "0.01em",
              textDecoration: "underline",
              textUnderlineOffset: 3,
              textDecorationColor:
                "color-mix(in oklab, var(--text-muted) 50%, transparent)",
            }}
          >
            Cancel this ride
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/trips"
      className="text-muted hover:text-text inline-flex items-center gap-1.5"
      style={{ fontSize: 13 }}
    >
      <Icon name="back" size={13} /> Back to trips
    </Link>
  );
}

function FareRow({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-muted" style={{ fontSize: 13 }}>
        {label}
      </span>
      <span className="tnum" style={{ fontSize: 14 }}>
        {fmtMoney(cents)}
      </span>
    </div>
  );
}

function ContactButton({
  href,
  icon,
  primary,
  secondary,
}: {
  href: string;
  icon: "phone" | "note" | "info";
  primary: string;
  secondary: string;
}) {
  return (
    <a
      href={href}
      className="rounded-[12px] p-4 flex items-center gap-3 transition active:scale-[0.985]"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        className="inline-grid place-items-center shrink-0"
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--accent)",
        }}
      >
        <Icon name={icon} size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 14, fontWeight: 600 }}>{primary}</div>
        <div
          className="text-muted truncate"
          style={{ fontSize: 12 }}
        >
          {secondary}
        </div>
      </div>
    </a>
  );
}

function ShareButton({ ride }: { ride: Ride }) {
  const handle = async () => {
    const text =
      `SDLuxury · ${fmtDayInLA(ride.pickup_at)} at ${fmtTime(
        ride.pickup_at,
      )}\n` +
      `Pickup: ${ride.pickup_address}` +
      (ride.dropoff_address ? `\nDropoff: ${ride.dropoff_address}` : "") +
      `\nStatus: ${prettyStatus(ride.status)}`;
    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        await navigator.share({ title: "Your SDLuxury trip", text });
      } else if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(text);
        pushToast("success", "Trip details copied.");
      }
    } catch {
      /* user dismissed share sheet */
    }
  };
  return (
    <button
      onClick={handle}
      className="inline-flex items-center gap-2 h-11 px-4 rounded-[10px] text-[14px] font-medium"
      style={{
        background: "var(--surface)",
        color: "var(--text)",
        border: "1px solid var(--border)",
      }}
    >
      <Icon name="copy" size={14} /> Share trip
    </button>
  );
}

function buildFlightSearchUrl(
  airline: string | null,
  number: string | null,
): string {
  const q = [airline, number].filter(Boolean).join(" ").trim() || "flight";
  return `https://www.google.com/search?q=${encodeURIComponent(
    `${q} flight status`,
  )}`;
}

function buildStatusTimestamps(
  events: ActivityEvent[],
  ride: Ride | null,
): Partial<Record<RideStatus, string>> {
  const out: Partial<Record<RideStatus, string>> = {};
  for (const e of events) {
    const msg = e.message ?? "";
    for (const s of TIMELINE) {
      if (msg.endsWith("→ " + s) || msg === "ride: created") {
        // status flips arrive as "ride: <old>→<new>"
        if (msg.endsWith("→ " + s)) {
          out[s] = e.created_at;
        }
      }
    }
  }
  // Fallback: if a ride was created already-scheduled, stamp scheduled at
  // the ride's own created_at so the "Confirmed" step gets a timestamp.
  if (ride && !out.scheduled && ride.status !== "requested") {
    out.scheduled = ride.created_at;
  }
  return out;
}

function stepState(
  current: RideStatus,
  step: RideStatus,
): "done" | "current" | "pending" {
  const idx = TIMELINE.indexOf(step);
  const curIdx = TIMELINE.indexOf(current);
  if (current === "cancelled") return "pending";
  if (curIdx < 0) return "pending"; // e.g. "requested"
  if (idx < curIdx) return "done";
  if (idx === curIdx) return "current";
  return "pending";
}

function canCancel(ride: Ride): boolean {
  if (ride.status !== "requested" && ride.status !== "scheduled") return false;
  // Only allow self-service cancellation up to 2h before pickup.
  const hoursOut =
    (new Date(ride.pickup_at).getTime() - Date.now()) / 1000 / 3600;
  return hoursOut > 2;
}

function cleanPhone(p: string): string {
  return p.replace(/[^\d+]/g, "");
}

function buildSmsBody(ride: Ride): string {
  return (
    `Hi Sergio — about my ${new Date(ride.pickup_at).toLocaleDateString(
      "en-US",
      {
        timeZone: BUSINESS_TZ,
        month: "short",
        day: "numeric",
      },
    )} ride: `
  );
}
