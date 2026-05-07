import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getRide,
  listClients,
  listDrivers,
  listVehicles,
  updateRideStatus,
} from "../lib/api";
import { fmtDateTime, fmtMoney, fmtTime } from "../lib/format";
import { Avatar } from "../components/Avatar";
import { Icon, type IconName } from "../components/Icon";
import { StatusBadge } from "../components/StatusBadge";
import type {
  Client,
  Driver,
  Ride,
  RideStatus,
  Vehicle,
} from "../lib/types";

type TabId = "overview" | "confirmation" | "briefing" | "waybill" | "invoice";

const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: "overview", label: "Overview", icon: "info" },
  { id: "confirmation", label: "Confirmation", icon: "phone" },
  { id: "briefing", label: "Driver briefing", icon: "doc" },
  { id: "waybill", label: "Waybill", icon: "doc" },
  { id: "invoice", label: "Invoice", icon: "wallet" },
];

export function RideDetail() {
  const { id } = useParams<{ id: string }>();
  const [ride, setRide] = useState<Ride | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await getRide(id);
        if (cancelled || !r) {
          setRide(r);
          return;
        }
        setRide(r);
        const [clients, drivers, vehicles] = await Promise.all([
          listClients(),
          listDrivers(),
          listVehicles(),
        ]);
        if (cancelled) return;
        setClient(clients.find((c) => c.id === r.client_id) ?? null);
        setDriver(drivers.find((d) => d.id === r.driver_id) ?? null);
        setVehicle(vehicles.find((v) => v.id === r.vehicle_id) ?? null);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const setStatus = async (status: RideStatus) => {
    if (!ride) return;
    setBusy(true);
    try {
      await updateRideStatus(ride.id, status);
      setRide({ ...ride, status });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const packets = useMemo(
    () => (ride ? buildPackets(ride, driver, vehicle, client) : null),
    [ride, driver, vehicle, client],
  );

  if (error)
    return (
      <div className="surface rounded-[12px] p-4 text-danger text-sm">
        {error}
      </div>
    );
  if (!ride || !packets)
    return <div className="text-muted">Loading…</div>;

  return (
    <div>
      {/* breadcrumb / back */}
      <Link
        to="/rides"
        className="inline-flex items-center gap-1.5 text-muted hover:text-text"
        style={{ fontSize: 12.5 }}
      >
        <Icon name="back" size={13} /> All rides
      </Link>

      {/* Page header */}
      <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <StatusBadge status={ride.status} />
            <span
              className="chip tnum text-muted"
              style={{ background: "transparent" }}
            >
              <Icon name="clock" size={12} />
              {fmtDateTime(ride.pickup_at)}
            </span>
            <span
              className="chip tnum text-muted"
              style={{ background: "transparent" }}
            >
              <Icon name="wallet" size={12} />
              {fmtMoney(ride.total_cents)}
              {ride.billing_terms ? ` · ${ride.billing_terms}` : ""}
            </span>
          </div>
          <h1
            className="truncate"
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
            }}
          >
            {ride.passenger_name}
          </h1>
          <p
            className="text-muted mt-1.5"
            style={{ fontSize: 13.5, lineHeight: 1.5 }}
          >
            {client?.company
              ? `${client.company} · `
              : ""}
            {client ? "Recurring client" : "One-off passenger"}
            {ride.passenger_phone ? ` · ${ride.passenger_phone}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/rides/${ride.id}/edit`}>
            <button
              className="inline-flex items-center justify-center gap-2 h-10 px-3.5 rounded-[8px] text-[13px] font-medium"
              style={{
                background: "transparent",
                color: "var(--text)",
                border: "1px solid var(--border)",
              }}
            >
              <Icon name="note" size={14} /> Edit
            </button>
          </Link>
          {ride.status !== "cancelled" ? (
            <button
              className="inline-flex items-center justify-center gap-2 h-10 px-3.5 rounded-[8px] text-[13px] font-medium"
              style={{
                background: "transparent",
                color: "var(--danger)",
                border: "1px solid var(--border)",
              }}
              onClick={() => setStatus("cancelled")}
              disabled={busy}
            >
              <Icon name="x" size={14} /> Cancel ride
            </button>
          ) : null}
        </div>
      </div>

      {/* Main + right rail */}
      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main */}
        <div className="min-w-0">
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className="tab"
                onClick={() => setTab(t.id)}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Icon name={t.icon} size={13} />
                  {t.label}
                </span>
              </button>
            ))}
          </div>

          <div className="pt-5">
            {tab === "overview" ? (
              <Overview
                ride={ride}
                driver={driver}
                vehicle={vehicle}
                client={client}
              />
            ) : (
              <CopyCard
                title={tabTitle(tab)}
                subtitle={tabSubtitle(tab, ride)}
                body={packets[tab]}
              />
            )}
          </div>
        </div>

        {/* Right rail */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <RightRail
            ride={ride}
            driver={driver}
            busy={busy}
            setStatus={setStatus}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Overview tab ─────────────────────────────────────────────────── */

function Overview({
  ride,
  driver,
  vehicle,
  client,
}: {
  ride: Ride;
  driver: Driver | null;
  vehicle: Vehicle | null;
  client: Client | null;
}) {
  return (
    <div className="grid gap-4">
      <article className="surface rounded-[12px]">
        <header
          className="px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h3 style={{ fontSize: 14.5, fontWeight: 600 }}>Trip details</h3>
        </header>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          <DetailRow icon="pin" label="Pickup" value={ride.pickup_address} />
          <DetailRow
            icon="flag"
            label="Dropoff"
            value={ride.dropoff_address ?? "—"}
          />
          <DetailRow
            icon="clock"
            label="Pickup time"
            value={fmtDateTime(ride.pickup_at)}
          />
          <DetailRow
            icon="car"
            label="Vehicle"
            value={
              vehicle
                ? `${vehicle.display_name}${
                    vehicle.plate ? ` · ${vehicle.plate}` : ""
                  }`
                : "Unassigned"
            }
          />
          <DetailRow
            icon="plane"
            label="Flight"
            value={
              ride.flight_number || ride.flight_airline
                ? `${ride.flight_airline ?? ""} ${ride.flight_number ?? ""}`.trim() +
                  (ride.flight_airport ? ` · ${ride.flight_airport}` : "") +
                  (ride.flight_terminal ? ` T${ride.flight_terminal}` : "")
                : "No flight"
            }
          />
          <DetailRow
            icon="user"
            label="Client account"
            value={
              client
                ? `${client.name}${client.company ? ` · ${client.company}` : ""}`
                : "One-off"
            }
          />
          {ride.notes ? (
            <div className="sm:col-span-2">
              <DetailRow icon="info" label="Notes" value={ride.notes} />
            </div>
          ) : null}
        </div>
      </article>

      <article className="surface rounded-[12px]">
        <header
          className="px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h3 style={{ fontSize: 14.5, fontWeight: 600 }}>Charges</h3>
        </header>
        <div className="p-5">
          <table className="w-full tnum" style={{ fontSize: 14 }}>
            <tbody>
              <tr>
                <td className="py-2 text-muted">Base fare</td>
                <td className="py-2 text-right">
                  {fmtMoney(ride.fare_cents)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-muted">Gratuity</td>
                <td className="py-2 text-right">
                  {fmtMoney(ride.gratuity_cents)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-muted">Parking & tolls</td>
                <td className="py-2 text-right">
                  {fmtMoney(ride.parking_cents)}
                </td>
              </tr>
              <tr style={{ borderTop: "1px solid var(--border)" }}>
                <td className="pt-3" style={{ fontWeight: 600 }}>
                  Total
                </td>
                <td
                  className="pt-3 text-right"
                  style={{ fontWeight: 600, fontSize: 16 }}
                >
                  {fmtMoney(ride.total_cents)}
                </td>
              </tr>
              {ride.billing_terms ? (
                <tr>
                  <td
                    className="pt-1 text-muted"
                    style={{ fontSize: 12.5 }}
                  >
                    Terms
                  </td>
                  <td
                    className="pt-1 text-right text-muted"
                    style={{ fontSize: 12.5 }}
                  >
                    {ride.billing_terms}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>

      {driver ? (
        <article className="surface rounded-[12px]">
          <header
            className="px-5 py-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <h3 style={{ fontSize: 14.5, fontWeight: 600 }}>Driver</h3>
          </header>
          <div className="p-5 flex items-center gap-3">
            <Avatar name={driver.full_name} size={44} />
            <div className="flex-1 min-w-0">
              <div
                style={{
                  fontSize: 14.5,
                  fontWeight: 600,
                  letterSpacing: "-0.005em",
                }}
              >
                {driver.full_name}
              </div>
              {driver.phone ? (
                <div
                  className="text-muted tnum"
                  style={{ fontSize: 12 }}
                >
                  {driver.phone}
                </div>
              ) : null}
            </div>
          </div>
        </article>
      ) : null}
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted shrink-0 mt-0.5">
        <Icon name={icon} size={14} />
      </span>
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
          {label}
        </div>
        <div style={{ fontSize: 14, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

/* ── Right rail ───────────────────────────────────────────────────── */

function RightRail({
  ride,
  driver,
  busy,
  setStatus,
}: {
  ride: Ride;
  driver: Driver | null;
  busy: boolean;
  setStatus: (s: RideStatus) => void;
}) {
  const next: RideStatus | null =
    ride.status === "scheduled" || ride.status === "requested"
      ? "in_progress"
      : ride.status === "in_progress"
      ? "completed"
      : null;
  const nextLabel =
    next === "in_progress"
      ? "Mark as in progress"
      : next === "completed"
      ? "Mark as completed"
      : "Ride completed";

  return (
    <aside className="flex flex-col gap-4">
      {ride.flight_number || ride.flight_airline ? (
        <article className="surface rounded-[12px]">
          <header
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <h3
              className="flex items-center gap-2"
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              <Icon name="plane" size={13} /> Flight
            </h3>
          </header>
          <div className="p-4 flex flex-col gap-3">
            <div>
              <div
                className="tnum"
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                }}
              >
                {ride.flight_airline ?? ""}{" "}
                <span className="text-accent">{ride.flight_number}</span>
              </div>
              <div
                className="text-muted"
                style={{ fontSize: 12.5 }}
              >
                {ride.flight_airport ?? "—"}
                {ride.flight_terminal ? ` · T${ride.flight_terminal}` : ""}
              </div>
            </div>
            <div
              className="rounded-[8px] px-3 py-2 text-[12.5px] flex items-start gap-2"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              <Icon name="info" size={13} className="text-accent" />
              <span className="text-muted">
                Live flight tracking will be added with the API integration.
              </span>
            </div>
          </div>
        </article>
      ) : null}

      {driver ? (
        <article className="surface rounded-[12px]">
          <header
            className="px-4 py-3"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <h3
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              Driver assigned
            </h3>
          </header>
          <div className="p-4 flex items-center gap-3">
            <Avatar name={driver.full_name} size={44} />
            <div className="flex-1 min-w-0">
              <div
                style={{
                  fontSize: 14.5,
                  fontWeight: 600,
                  letterSpacing: "-0.005em",
                }}
              >
                {driver.full_name}
              </div>
              {driver.phone ? (
                <div
                  className="text-muted tnum"
                  style={{ fontSize: 12 }}
                >
                  {driver.phone}
                </div>
              ) : null}
            </div>
          </div>
          {driver.phone ? (
            <div className="px-4 pb-4 grid grid-cols-2 gap-2">
              <a
                href={`tel:${driver.phone}`}
                className="inline-flex items-center justify-center gap-2 h-10 rounded-[8px] text-[13px] font-medium"
                style={{
                  background: "transparent",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                <Icon name="phone" size={13} /> Call
              </a>
              <a
                href={`sms:${driver.phone}`}
                className="inline-flex items-center justify-center gap-2 h-10 rounded-[8px] text-[13px] font-medium"
                style={{
                  background: "transparent",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                <Icon name="phone" size={13} /> Message
              </a>
            </div>
          ) : null}
        </article>
      ) : null}

      <article className="surface rounded-[12px]">
        <header
          className="px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            Status
          </h3>
        </header>
        <div className="p-4 flex flex-col gap-2">
          {next ? (
            <button
              className="inline-flex items-center justify-center gap-2 rounded-[8px] text-[14px] font-semibold transition"
              style={{
                height: 42,
                background:
                  next === "completed"
                    ? "color-mix(in oklab, var(--success) 22%, var(--surface))"
                    : "var(--accent)",
                color:
                  next === "completed" ? "var(--success)" : "#15161B",
                border: `1px solid ${
                  next === "completed"
                    ? "color-mix(in oklab, var(--success) 60%, var(--border))"
                    : "var(--accent-strong)"
                }`,
              }}
              onClick={() => setStatus(next)}
              disabled={busy}
            >
              <Icon
                name={next === "completed" ? "check" : "arrow"}
                size={15}
              />
              {nextLabel}
            </button>
          ) : (
            <div
              className="rounded-[8px] px-3 py-3 text-center"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              <Icon
                name="check"
                size={18}
                className="text-accent inline-block"
              />
              <div
                className="mt-1"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                {ride.status === "completed"
                  ? "Ride completed"
                  : "Ride cancelled"}
              </div>
            </div>
          )}
          {ride.status === "in_progress" ? (
            <button
              className="inline-flex items-center justify-center gap-2 h-9 rounded-[8px] text-[13px]"
              style={{
                background: "transparent",
                color: "var(--text)",
                border: "1px solid var(--border)",
              }}
              onClick={() => setStatus("scheduled")}
              disabled={busy}
            >
              Revert to scheduled
            </button>
          ) : null}
        </div>
      </article>
    </aside>
  );
}

/* ── Copy-ready packet card ──────────────────────────────────────── */

function CopyCard({
  title,
  subtitle,
  body,
}: {
  title: string;
  subtitle?: string;
  body: string;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    try {
      navigator.clipboard?.writeText(body);
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <article className="surface rounded-[12px] overflow-hidden">
      <header
        className="flex items-start justify-between gap-3 px-5 py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="min-w-0">
          <h3
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              letterSpacing: "-0.005em",
            }}
          >
            {title}
          </h3>
          {subtitle ? (
            <p
              className="text-muted mt-0.5"
              style={{ fontSize: 12.5 }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12.5px] font-medium transition shrink-0"
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
              <Icon name="check" size={13} />
              <span className="pop-in">Copied</span>
            </>
          ) : (
            <>
              <Icon name="copy" size={13} />
              Copy
            </>
          )}
        </button>
      </header>
      <div className="p-5">
        <pre className="copy-block">{body}</pre>
      </div>
    </article>
  );
}

/* ── Tab metadata + packet builders ──────────────────────────────── */

function tabTitle(tab: TabId): string {
  switch (tab) {
    case "confirmation":
      return "Client confirmation";
    case "briefing":
      return "Driver briefing";
    case "waybill":
      return "Waybill";
    case "invoice":
      return "Invoice";
    default:
      return "";
  }
}

function tabSubtitle(tab: TabId, ride: Ride): string {
  switch (tab) {
    case "confirmation":
      return `Ready to text or email to ${ride.passenger_name}.`;
    case "briefing":
      return "Sent to the assigned driver.";
    case "waybill":
      return "DOT-compliant trip ticket · printable.";
    case "invoice":
      return ride.billing_terms
        ? `${ride.billing_terms} · billed to client.`
        : "Set billing terms on the ride to use Net terms.";
    default:
      return "";
  }
}

function buildPackets(
  ride: Ride,
  driver: Driver | null,
  vehicle: Vehicle | null,
  client: Client | null,
): Record<Exclude<TabId, "overview">, string> {
  const when = fmtDateTime(ride.pickup_at);
  const time = fmtTime(ride.pickup_at);
  const total = fmtMoney(ride.total_cents);
  const flight =
    ride.flight_number || ride.flight_airline
      ? `${ride.flight_airline ?? ""} ${ride.flight_number ?? ""}`.trim() +
        (ride.flight_status ? ` — ${ride.flight_status}` : "")
      : "—";
  const driverLine = driver
    ? `${driver.full_name}${driver.phone ? ` · ${driver.phone}` : ""}`
    : "Unassigned";
  const vehicleLine = vehicle
    ? `${vehicle.display_name}${vehicle.plate ? ` · ${vehicle.plate}` : ""}`
    : "Unassigned";

  const confirmation = [
    `Hello ${ride.passenger_name},`,
    "",
    "This confirms your private car service with SDLuxury Transportation.",
    "",
    `  Date         ${when}`,
    `  Pickup       ${ride.pickup_address}`,
    `  Dropoff      ${ride.dropoff_address ?? "—"}`,
    `  Flight       ${flight}`,
    `  Vehicle      ${vehicleLine}`,
    `  Driver       ${driverLine}`,
    "",
    `Total fare: ${total}${
      ride.billing_terms ? `, billed ${ride.billing_terms}.` : "."
    }`,
    "",
    "Your driver will text on approach. Reply STOP to opt out of SMS.",
    "",
    "— SDLuxury Transportation, Inc.",
  ].join("\n");

  const briefing = [
    `Ride · ${when}`,
    `Passenger: ${ride.passenger_name}${
      ride.passenger_phone ? ` (${ride.passenger_phone})` : ""
    }`,
    client?.company
      ? `Account:   ${client.company}${
          ride.billing_terms ? ` — ${ride.billing_terms}` : ""
        }`
      : null,
    "",
    "Pickup",
    `  ${ride.pickup_address}`,
    "",
    "Dropoff",
    `  ${ride.dropoff_address ?? "—"}`,
    ride.flight_number || ride.flight_airline
      ? `  Flight ${flight}`
      : null,
    "",
    `Vehicle: ${vehicleLine}`,
    ride.notes ? `Notes:   ${ride.notes}` : null,
    "",
    "Confirm with passenger 30 min before pickup.",
  ]
    .filter(Boolean)
    .join("\n");

  const waybill = [
    "WAYBILL — SDLUXURY TRANSPORTATION, INC.",
    "",
    `Date of service:  ${fmtDateTime(ride.pickup_at)}`,
    `Passenger:        ${ride.passenger_name}`,
    `Pickup time:      ${time}`,
    `Pickup address:   ${ride.pickup_address}`,
    `Dropoff address:  ${ride.dropoff_address ?? "—"}`,
    `Vehicle:          ${vehicleLine}`,
    `Driver:           ${driverLine}`,
    "",
    `Base fare ............... ${fmtMoney(ride.fare_cents)}`,
    `Gratuity ................ ${fmtMoney(ride.gratuity_cents)}`,
    `Parking & tolls ......... ${fmtMoney(ride.parking_cents)}`,
    `                          ─────────`,
    `Total ................... ${total}`,
    "",
    `Billing terms:    ${ride.billing_terms ?? "—"}`,
    "",
    "Signature: __________________________   Date: ___________",
  ].join("\n");

  const invoice = [
    `INVOICE`,
    `Issued: ${new Date().toLocaleDateString()}`,
    "",
    "Bill to",
    `  ${client?.company ?? ride.passenger_name}`,
    client?.company ? `  Attn: ${ride.passenger_name}` : null,
    client?.email ? `  ${client.email}` : null,
    "",
    "Description                                          Amount",
    "─────────────────────────────────────────────────────────────",
    `Private car service · ${fmtDateTime(
      ride.pickup_at,
    )}                ${fmtMoney(ride.fare_cents)}`,
    `  ${ride.pickup_address} → ${ride.dropoff_address ?? "—"}`,
    `Gratuity                                             ${fmtMoney(
      ride.gratuity_cents,
    )}`,
    `Parking & tolls                                      ${fmtMoney(
      ride.parking_cents,
    )}`,
    "─────────────────────────────────────────────────────────────",
    `                                       Total       ${total}`,
    "",
    "Remit to",
    "  SDLuxury Transportation, Inc.",
  ]
    .filter(Boolean)
    .join("\n");

  return { confirmation, briefing, waybill, invoice };
}
