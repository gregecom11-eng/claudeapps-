import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addRideExtra,
  claimDriverByEmail,
  getOrgSettings,
  listRideExtras,
  listRides,
  listVehicles,
  updateMyProfile,
  updateRideStatus,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { downloadICS } from "../lib/calendar";
import { BUSINESS_TZ, fmtDate, fmtMoney, fmtTime } from "../lib/format";
import { Avatar } from "../components/Avatar";
import { Icon, type IconName } from "../components/Icon";
import { StatusBadge } from "../components/StatusBadge";
import type {
  Driver as DriverType,
  Ride,
  RideExtra,
  RideStatus,
  Vehicle,
} from "../lib/types";

type Bucket = "Morning" | "Afternoon" | "Evening";

function bucketOf(iso: string): Bucket {
  const h = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: BUSINESS_TZ,
      hour: "numeric",
      hour12: false,
    }).format(new Date(iso)),
    10,
  );
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

function laOffsetFor(d: Date): string {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    timeZoneName: "longOffset",
  })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value;
  return part?.replace("GMT", "") || "+00:00";
}
function laDayBoundsFor(d = new Date()): { from: string; to: string } {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const off = laOffsetFor(d);
  return {
    from: new Date(`${day}T00:00:00${off}`).toISOString(),
    to: new Date(`${day}T23:59:59.999${off}`).toISOString(),
  };
}

export function Driver() {
  const { session, profile } = useAuth();
  const [linked, setLinked] = useState<DriverType | null | "loading">("loading");
  const [today, setToday] = useState<Ride[] | null>(null);
  const [tomorrow, setTomorrow] = useState<Ride[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    claimDriverByEmail()
      .then((d) => {
        if (!cancelled) setLinked(d);
      })
      .catch((e) => {
        if (!cancelled) {
          setLinked(null);
          setError(e instanceof Error ? e.message : "Driver linking failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const reload = () => {
    const todayWindow = laDayBoundsFor();
    const tomorrowWindow = laDayBoundsFor(
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    );
    Promise.all([
      listRides(todayWindow),
      listRides({ ...tomorrowWindow, limit: 5 }),
      listVehicles(),
    ])
      .then(([t, tm, v]) => {
        setToday(t);
        setTomorrow(tm);
        setVehicles(v);
        setError(null);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      );
  };
  useEffect(() => {
    if (linked === "loading") return;
    reload();
  }, [linked]);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles],
  );

  if (linked === "loading") {
    return <div className="text-muted">Loading…</div>;
  }

  if (!linked) {
    return <NotLinkedNotice email={session?.user?.email ?? ""} error={error} />;
  }

  const groups = groupByBucket(today ?? []);

  return (
    <div className="space-y-6">
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
          {new Date().toLocaleDateString("en-US", {
            timeZone: BUSINESS_TZ,
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>
        <h1
          className="mt-1"
          style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          {firstName(profile?.full_name ?? linked.full_name)}'s day
        </h1>
        <p
          className="text-muted mt-1"
          style={{ fontSize: 13.5, lineHeight: 1.5 }}
        >
          {today === null
            ? "Loading…"
            : today.length === 0
            ? "Nothing on the books today. Enjoy a quiet morning."
            : `${today.length} ${today.length === 1 ? "ride" : "rides"} assigned to you today.`}
        </p>
      </div>

      {error ? (
        <div className="surface rounded-[12px] p-4 text-danger text-sm">
          {error}
        </div>
      ) : null}

      {today && today.length > 0 ? (
        <div className="space-y-7">
          {(["Morning", "Afternoon", "Evening"] as const).map((b) => {
            const items = groups[b];
            if (items.length === 0) return null;
            return (
              <section key={b}>
                <div className="flex items-center gap-3 mb-3">
                  <Icon
                    name={b === "Morning" ? "sun" : b === "Evening" ? "moon2" : "spark"}
                    size={14}
                    className="text-muted"
                  />
                  <h2
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {b}
                  </h2>
                  <div
                    className="flex-1 h-px"
                    style={{ background: "var(--border)" }}
                  />
                </div>
                <ul className="space-y-3">
                  {items.map((r) => (
                    <li key={r.id}>
                      <DriverRideCard
                        ride={r}
                        vehicle={
                          r.vehicle_id ? vehiclesById.get(r.vehicle_id) : null
                        }
                        onTap={() => setActiveRide(r)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}

      {tomorrow.length > 0 ? (
        <section className="pt-2">
          <div className="flex items-center gap-3 mb-3">
            <Icon name="calendar" size={14} className="text-muted" />
            <h2
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Tomorrow preview
            </h2>
            <div
              className="flex-1 h-px"
              style={{ background: "var(--border)" }}
            />
          </div>
          <ul className="surface rounded-[12px] divide-y divide-border">
            {tomorrow.map((r) => (
              <li
                key={r.id}
                className="px-4 py-3 flex items-center gap-3 cursor-pointer"
                onClick={() => setActiveRide(r)}
              >
                <div className="tabular text-sm font-medium w-16">
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
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activeRide ? (
        <RideSheet
          ride={activeRide}
          driver={linked}
          vehicle={
            activeRide.vehicle_id
              ? vehiclesById.get(activeRide.vehicle_id) ?? null
              : null
          }
          onClose={() => setActiveRide(null)}
          onChange={async (updates) => {
            // Status change
            if (updates.status) {
              try {
                const updated = await updateRideStatus(
                  activeRide.id,
                  updates.status,
                );
                setActiveRide(updated);
                reload();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Update failed");
              }
            }
          }}
        />
      ) : null}
    </div>
  );
}

function NotLinkedNotice({
  email,
  error,
}: {
  email: string;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <h1
        style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}
      >
        You're signed in
      </h1>
      <div
        className="surface rounded-[12px] p-5 text-sm space-y-3"
        style={{ lineHeight: 1.55 }}
      >
        <p>
          But your driver record isn't linked yet. Ask your dispatcher to add
          you under <strong>Settings → Drivers</strong> with this exact email:
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
          {email}
        </code>
        <p className="text-muted">
          Once they save, refresh this page and you'll see your day.
        </p>
      </div>
      {error ? <div className="text-danger text-sm">{error}</div> : null}
    </div>
  );
}

/* ── Compact ride card (no $$ shown) ───────────────────────────── */
function DriverRideCard({
  ride,
  vehicle,
  onTap,
}: {
  ride: Ride;
  vehicle: Vehicle | null | undefined;
  onTap: () => void;
}) {
  const isLive = ride.status === "in_progress" || ride.status === "arrived";
  return (
    <button
      onClick={onTap}
      className="w-full text-left surface rounded-[12px] p-4 transition"
      style={{
        boxShadow: isLive ? "0 0 0 1px var(--accent)" : undefined,
        background: isLive
          ? "color-mix(in oklab, var(--accent) 6%, var(--surface))"
          : undefined,
      }}
    >
      <header className="flex items-center justify-between gap-3">
        <div
          className="tabular"
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          {fmtTime(ride.pickup_at)}
        </div>
        <StatusBadge status={ride.status} />
      </header>
      <div className="mt-2 flex items-center gap-3">
        <Avatar name={ride.passenger_name} size={28} />
        <div className="min-w-0 flex-1">
          <div
            className="truncate"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            {ride.passenger_name}
          </div>
          <div className="text-muted truncate" style={{ fontSize: 12 }}>
            {ride.pickup_address}
            {ride.dropoff_address ? ` → ${ride.dropoff_address}` : ""}
          </div>
        </div>
      </div>
      {vehicle ? (
        <div
          className="mt-2 inline-flex items-center gap-1.5 text-muted"
          style={{ fontSize: 12 }}
        >
          <Icon name="car" size={12} />
          <span className="tnum">
            {vehicle.display_name}
            {vehicle.plate ? ` · ${vehicle.plate}` : ""}
          </span>
        </div>
      ) : null}
    </button>
  );
}

/* ── Full ride sheet (the main work area for an active ride) ─── */
type SheetTab = "briefing" | "waybill";

function RideSheet({
  ride,
  driver,
  vehicle,
  onClose,
  onChange,
}: {
  ride: Ride;
  driver: DriverType;
  vehicle: Vehicle | null;
  onClose: () => void;
  onChange: (updates: { status?: RideStatus }) => void;
}) {
  const [tab, setTab] = useState<SheetTab>("briefing");
  const [extras, setExtras] = useState<RideExtra[]>([]);
  const [extrasErr, setExtrasErr] = useState<string | null>(null);
  const [dispatchPhone, setDispatchPhone] = useState<string | null>(null);

  useEffect(() => {
    getOrgSettings()
      .then((s) => setDispatchPhone(s.dispatch_phone ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    listRideExtras(ride.id)
      .then(setExtras)
      .catch((e) =>
        setExtrasErr(e instanceof Error ? e.message : "Failed to load extras"),
      );
  }, [ride.id]);

  const reloadExtras = () =>
    listRideExtras(ride.id).then(setExtras).catch(() => {});

  const mapsUrl = (addr: string) =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end md:items-center justify-center"
      style={{ background: "color-mix(in oklab, #000 50%, transparent)" }}
      onClick={onClose}
    >
      <div
        className="surface rounded-t-[16px] md:rounded-[16px] w-full md:max-w-[560px] max-h-[94vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        {/* Header */}
        <div
          className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 sticky top-0"
          style={{
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <div className="min-w-0">
            <div
              className="text-muted tabular"
              style={{ fontSize: 12.5 }}
            >
              {fmtDate(ride.pickup_at)} · {fmtTime(ride.pickup_at)} PT
            </div>
            <h2
              className="truncate"
              style={{
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              {ride.passenger_name}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-grid place-items-center"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Status progress strip */}
        <ProgressStrip status={ride.status} />

        {/* Tabs */}
        <div
          className="flex gap-0 px-1"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {(["briefing", "waybill"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="tab"
              role="tab"
              aria-selected={tab === t}
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon
                  name={t === "briefing" ? "info" : "doc"}
                  size={13}
                />
                {t === "briefing" ? "Briefing" : "Waybill"}
              </span>
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => downloadICS(ride, driver, vehicle)}
            className="inline-flex items-center gap-1.5 px-3 text-muted hover:text-text"
            style={{ fontSize: 12.5 }}
            title="Add this ride to your calendar"
          >
            <Icon name="calendar" size={13} /> .ics
          </button>
        </div>

        {tab === "briefing" ? (
          <div className="p-5 space-y-4">
            {ride.passenger_phone ? (
              <a
                href={`tel:${ride.passenger_phone}`}
                className="w-full inline-flex items-center justify-center gap-2 rounded-[10px] h-12 text-[15px] font-semibold"
                style={{
                  background:
                    "color-mix(in oklab, var(--success) 22%, var(--surface))",
                  color: "var(--success)",
                  border:
                    "1px solid color-mix(in oklab, var(--success) 50%, var(--border))",
                }}
              >
                <Icon name="phone" size={16} /> Call{" "}
                {firstName(ride.passenger_name)}
              </a>
            ) : null}

            {dispatchPhone ? (
              <a
                href={`sms:${dispatchPhone}?body=${encodeURIComponent(
                  `Re: ${ride.passenger_name} ride at ${fmtTime(ride.pickup_at)} — `,
                )}`}
                className="w-full inline-flex items-center justify-center gap-2 rounded-[10px] h-11 text-[14px] font-medium"
                style={{
                  background: "transparent",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                <Icon name="phone" size={14} /> Message dispatch
              </a>
            ) : null}

            <SheetRow icon="pin" label="Pickup">
              {ride.pickup_address}
              <div className="mt-1.5">
                <a
                  href={mapsUrl(ride.pickup_address)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-accent"
                  style={{ fontSize: 12.5, fontWeight: 500 }}
                >
                  Open in Maps <Icon name="arrow" size={11} />
                </a>
              </div>
            </SheetRow>

            {ride.dropoff_address ? (
              <SheetRow icon="flag" label="Dropoff">
                {ride.dropoff_address}
                <div className="mt-1.5">
                  <a
                    href={mapsUrl(ride.dropoff_address)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-accent"
                    style={{ fontSize: 12.5, fontWeight: 500 }}
                  >
                    Open in Maps <Icon name="arrow" size={11} />
                  </a>
                </div>
              </SheetRow>
            ) : null}

            {ride.flight_number || ride.flight_airline ? (
              <SheetRow icon="plane" label="Flight">
                <span className="tnum">
                  {ride.flight_airline ?? ""} {ride.flight_number ?? ""}
                  {ride.flight_airport ? ` · ${ride.flight_airport}` : ""}
                  {ride.flight_terminal ? ` T${ride.flight_terminal}` : ""}
                </span>
              </SheetRow>
            ) : null}

            {vehicle ? (
              <SheetRow icon="car" label="Vehicle">
                <span className="tnum">
                  {vehicle.display_name}
                  {vehicle.plate ? ` · plate ${vehicle.plate}` : ""}
                </span>
              </SheetRow>
            ) : null}

            {ride.notes ? (
              <SheetRow icon="info" label="Dispatch notes">
                <span style={{ whiteSpace: "pre-wrap" }}>{ride.notes}</span>
              </SheetRow>
            ) : null}

            {/* Extras section */}
            <ExtrasSection
              rideId={ride.id}
              extras={extras}
              error={extrasErr}
              onChanged={reloadExtras}
            />
          </div>
        ) : (
          <WaybillView
            ride={ride}
            driver={driver}
            vehicle={vehicle}
            extras={extras}
          />
        )}

        {/* Action bar */}
        <div
          className="px-5 py-4 space-y-2 sticky bottom-0"
          style={{
            borderTop: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <ActionBar
            status={ride.status}
            onAdvance={(s) => onChange({ status: s })}
          />
        </div>
      </div>
    </div>
  );
}

function ProgressStrip({ status }: { status: RideStatus }) {
  const STEPS: { key: RideStatus; label: string }[] = [
    { key: "scheduled", label: "Booked" },
    { key: "on_the_way", label: "On the way" },
    { key: "arrived", label: "At pickup" },
    { key: "in_progress", label: "On board" },
    { key: "completed", label: "Done" },
  ];
  const currentIdx = STEPS.findIndex((s) => s.key === status);
  const idx = status === "cancelled" ? -1 : currentIdx;

  return (
    <div className="px-5 py-3" style={{ background: "var(--surface-2)" }}>
      <div className="flex items-center gap-1.5">
        {STEPS.map((s, i) => {
          const done = idx > i;
          const active = idx === i;
          return (
            <div
              key={s.key}
              className="flex-1"
              style={{
                height: 4,
                borderRadius: 999,
                background: done
                  ? "var(--success)"
                  : active
                  ? "var(--accent)"
                  : "var(--border)",
                transition: "background 200ms",
              }}
              title={s.label}
            />
          );
        })}
      </div>
      <div
        className="mt-2 text-muted"
        style={{ fontSize: 11.5, letterSpacing: "0.02em" }}
      >
        {status === "cancelled"
          ? "Ride cancelled"
          : currentIdx >= 0
          ? STEPS[currentIdx].label
          : "Pending"}
      </div>
    </div>
  );
}

function ActionBar({
  status,
  onAdvance,
}: {
  status: RideStatus;
  onAdvance: (s: RideStatus) => void;
}) {
  const next = nextStatus(status);
  if (!next) {
    return (
      <div
        className="rounded-[10px] px-3 py-3 text-center text-sm"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
        }}
      >
        <Icon name="check" size={18} className="text-accent inline-block" />
        <div className="mt-1" style={{ fontWeight: 600 }}>
          Ride {status}
        </div>
      </div>
    );
  }
  const labels: Record<RideStatus, string> = {
    requested: "",
    scheduled: "On my way",
    on_the_way: "Arrived at pickup",
    arrived: "Start trip — passenger on board",
    in_progress: "Mark completed",
    completed: "",
    cancelled: "",
  };
  const label = labels[next];
  return (
    <>
      <button
        onClick={() => onAdvance(next)}
        className="w-full inline-flex items-center justify-center gap-2 rounded-[10px] h-12 text-[15px] font-semibold"
        style={{
          background:
            next === "completed"
              ? "color-mix(in oklab, var(--success) 22%, var(--surface))"
              : "var(--accent)",
          color: next === "completed" ? "var(--success)" : "#15161B",
          border: `1px solid ${
            next === "completed"
              ? "color-mix(in oklab, var(--success) 50%, var(--border))"
              : "var(--accent-strong)"
          }`,
        }}
      >
        <Icon
          name={next === "completed" ? "check" : "arrow"}
          size={16}
        />
        {label}
      </button>
      {status !== "scheduled" && status !== "completed" ? (
        <button
          onClick={() => onAdvance(prevStatus(status) ?? "scheduled")}
          className="w-full inline-flex items-center justify-center h-9 rounded-[10px] text-[12.5px]"
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
        >
          ← Back to {prevStatusLabel(status)}
        </button>
      ) : null}
    </>
  );
}

function nextStatus(s: RideStatus): RideStatus | null {
  switch (s) {
    case "scheduled":
    case "requested":
      return "on_the_way";
    case "on_the_way":
      return "arrived";
    case "arrived":
      return "in_progress";
    case "in_progress":
      return "completed";
    default:
      return null;
  }
}
function prevStatus(s: RideStatus): RideStatus | null {
  switch (s) {
    case "on_the_way":
      return "scheduled";
    case "arrived":
      return "on_the_way";
    case "in_progress":
      return "arrived";
    default:
      return null;
  }
}
function prevStatusLabel(s: RideStatus): string {
  const p = prevStatus(s);
  if (p === "scheduled") return "scheduled";
  if (p === "on_the_way") return "on the way";
  if (p === "arrived") return "at pickup";
  return "previous";
}

/* ── Extras section ────────────────────────────────────────────── */
function ExtrasSection({
  rideId,
  extras,
  error,
  onChanged,
}: {
  rideId: string;
  extras: RideExtra[];
  error: string | null;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ description: "", amount: "" });
  const [busy, setBusy] = useState(false);

  const total = extras.reduce((s, e) => s + (e.amount_cents ?? 0), 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.description.trim()) return;
    setBusy(true);
    try {
      const cents = Math.round(parseFloat(draft.amount || "0") * 100) || 0;
      await addRideExtra(rideId, draft.description.trim(), cents);
      setDraft({ description: "", amount: "" });
      setAdding(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="rounded-[10px] p-3"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-muted"
          style={{
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Extra stops · services
        </div>
        <button
          onClick={() => setAdding((a) => !a)}
          className="inline-flex items-center gap-1 text-accent"
          style={{ fontSize: 12, fontWeight: 600 }}
        >
          <Icon name={adding ? "x" : "plus"} size={11} />
          {adding ? "Cancel" : "Add"}
        </button>
      </div>

      {extras.length === 0 && !adding ? (
        <div className="text-muted" style={{ fontSize: 12.5 }}>
          None yet. Add a stop, wait time, or anything that adjusts the fare.
        </div>
      ) : null}

      {extras.length > 0 ? (
        <ul className="space-y-1.5">
          {extras.map((x) => (
            <li
              key={x.id}
              className="flex items-center gap-2 text-sm"
            >
              <span className="flex-1 min-w-0 truncate">{x.description}</span>
              <span className="tabular text-muted" style={{ fontSize: 13 }}>
                +{fmtMoney(x.amount_cents ?? 0)}
              </span>
            </li>
          ))}
          {total > 0 ? (
            <li
              className="flex items-center gap-2 pt-1.5"
              style={{ borderTop: "1px dashed var(--border)" }}
            >
              <span
                className="flex-1 text-muted"
                style={{ fontSize: 12 }}
              >
                Extras total
              </span>
              <span
                className="tabular"
                style={{ fontSize: 14, fontWeight: 600 }}
              >
                +{fmtMoney(total)}
              </span>
            </li>
          ) : null}
        </ul>
      ) : null}

      {adding ? (
        <form onSubmit={submit} className="mt-3 grid gap-2">
          <input
            className="field"
            placeholder="e.g. Extra stop at Beverly Center"
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
            autoFocus
            required
          />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted tnum"
                style={{ fontSize: 14, pointerEvents: "none" }}
              >
                $
              </span>
              <input
                className="field tnum"
                style={{ paddingLeft: 28 }}
                inputMode="decimal"
                placeholder="Amount"
                value={draft.amount}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    amount: e.target.value.replace(/[^0-9.]/g, ""),
                  })
                }
              />
            </div>
            <button
              type="submit"
              disabled={busy || !draft.description.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-[8px] h-10 px-4 text-[13px] font-semibold disabled:opacity-50"
              style={{
                background: "var(--accent)",
                color: "#15161B",
                border: "1px solid var(--accent-strong)",
              }}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <div className="mt-2 text-danger" style={{ fontSize: 12 }}>
          {error}
        </div>
      ) : null}
    </section>
  );
}

/* ── Waybill view (DOT-compliant slip for police stops) ──────── */
function WaybillView({
  ride,
  driver,
  vehicle,
  extras,
}: {
  ride: Ride;
  driver: DriverType;
  vehicle: Vehicle | null;
  extras: RideExtra[];
}) {
  const extrasTotal = extras.reduce(
    (s, e) => s + (e.amount_cents ?? 0),
    0,
  );
  const grandTotal = ride.total_cents + extrasTotal;

  const lines = [
    "WAYBILL — SDLUXURY TRANSPORTATION, INC.",
    "",
    `Date of service:  ${fmtDate(ride.pickup_at)}`,
    `Pickup time:      ${fmtTime(ride.pickup_at)} PT`,
    `Passenger:        ${ride.passenger_name}`,
    `Pickup address:   ${ride.pickup_address}`,
    `Dropoff address:  ${ride.dropoff_address ?? "—"}`,
    `Vehicle:          ${vehicle ? `${vehicle.display_name}${vehicle.plate ? ` · ${vehicle.plate}` : ""}` : "—"}`,
    `Driver:           ${driver.full_name}`,
    "",
    `Base fare ............... ${fmtMoney(ride.fare_cents)}`,
    `Gratuity ................ ${fmtMoney(ride.gratuity_cents)}`,
    `Parking & tolls ......... ${fmtMoney(ride.parking_cents)}`,
    ...(extras.length > 0
      ? [
          ...extras.map(
            (x) =>
              `Extra: ${x.description.padEnd(14, ".").slice(0, 14)} +${fmtMoney(x.amount_cents ?? 0)}`,
          ),
        ]
      : []),
    `                          ─────────`,
    `Total ................... ${fmtMoney(grandTotal)}`,
    "",
    `Billing terms:    ${ride.billing_terms ?? "—"}`,
  ].join("\n");

  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard?.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="p-5 space-y-3">
      <div
        className="text-muted"
        style={{ fontSize: 12, lineHeight: 1.5 }}
      >
        Show this to law enforcement if requested. It's a DOT-style trip
        ticket with no client billing details exposed.
      </div>
      <div
        className="rounded-[8px] p-4 mono"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          fontSize: 12,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}
      >
        {lines}
      </div>
      <button
        onClick={onCopy}
        className="w-full inline-flex items-center justify-center gap-2 rounded-[10px] h-10 text-[13.5px] font-medium"
        style={{
          background: "transparent",
          border: "1px solid var(--border)",
          color: copied ? "var(--success)" : "var(--text)",
        }}
      >
        <Icon name={copied ? "check" : "copy"} size={14} />
        {copied ? "Copied" : "Copy waybill text"}
      </button>
    </div>
  );
}

function SheetRow({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted shrink-0 mt-0.5">
        <Icon name={icon} size={14} />
      </span>
      <div className="min-w-0 flex-1">
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
        <div style={{ fontSize: 14, marginTop: 2 }}>{children}</div>
      </div>
    </div>
  );
}

/* ── helpers ───────────────────────────────────────────────────── */
function firstName(s: string | null | undefined): string {
  if (!s) return "";
  return s.split(/\s+/)[0].replace(/[(),]/g, "");
}

function groupByBucket(rides: Ride[]) {
  const out: Record<Bucket, Ride[]> = {
    Morning: [],
    Afternoon: [],
    Evening: [],
  };
  rides
    .slice()
    .sort(
      (a, b) =>
        new Date(a.pickup_at).getTime() - new Date(b.pickup_at).getTime(),
    )
    .forEach((r) => out[bucketOf(r.pickup_at)].push(r));
  return out;
}

/* ── Past + Profile sub-routes ─────────────────────────────────── */

export function DriverPast() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listRides({ limit: 100 }), listVehicles()])
      .then(([r, v]) => {
        const past = r
          .filter(
            (x) =>
              new Date(x.pickup_at).getTime() < Date.now() ||
              x.status === "completed" ||
              x.status === "cancelled",
          )
          .sort(
            (a, b) =>
              new Date(b.pickup_at).getTime() -
              new Date(a.pickup_at).getTime(),
          );
        setRides(past);
        setVehicles(v);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      );
  }, []);

  const vMap = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="text-muted hover:text-text"
          style={{ fontSize: 12.5 }}
        >
          <Icon name="back" size={13} /> Today
        </Link>
      </div>
      <h1
        style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}
      >
        Past rides
      </h1>
      {error ? (
        <div className="text-danger text-sm">{error}</div>
      ) : null}
      {rides.length === 0 ? (
        <div className="text-muted text-sm">Nothing yet.</div>
      ) : (
        <ul className="surface rounded-[12px] divide-y divide-border">
          {rides.map((r) => {
            const v = r.vehicle_id ? vMap.get(r.vehicle_id) : null;
            return (
              <li key={r.id} className="px-4 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate"
                    style={{ fontSize: 14, fontWeight: 600 }}
                  >
                    {r.passenger_name}
                  </div>
                  <div
                    className="text-muted truncate tabular"
                    style={{ fontSize: 12 }}
                  >
                    {fmtDate(r.pickup_at)} · {fmtTime(r.pickup_at)}
                    {v ? ` · ${v.display_name}` : ""}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function DriverProfile() {
  const { profile, session } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile?.full_name, profile?.phone]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await updateMyProfile({
        full_name: name.trim() || null,
        phone: phone.trim() || null,
      });
      setMsg("Saved");
      setTimeout(() => setMsg(null), 1600);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="text-muted hover:text-text"
          style={{ fontSize: 12.5 }}
        >
          <Icon name="back" size={13} /> Today
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <Avatar name={name || "?"} size={56} />
        <div className="min-w-0">
          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            {name || "Profile"}
          </h1>
          <div
            className="text-muted truncate"
            style={{ fontSize: 12.5 }}
          >
            {session?.user?.email}
          </div>
        </div>
      </div>

      <div className="surface rounded-[12px] p-5 space-y-4">
        <Field label="Full name">
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field
          label="Phone"
          hint="Used for the Call/Message buttons clients see."
          optional
        >
          <input
            className="field tnum"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (___) ___-____"
          />
        </Field>
        <div className="flex items-center justify-between gap-3">
          {msg ? (
            <div
              className="text-success"
              style={{ fontSize: 12.5 }}
            >
              {msg}
            </div>
          ) : (
            <span />
          )}
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[8px] text-[13.5px] font-semibold disabled:opacity-50"
            style={{
              background: "var(--accent)",
              color: "#15161B",
              border: "1px solid var(--accent-strong)",
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {optional ? (
          <span
            style={{
              textTransform: "none",
              fontWeight: 400,
              marginLeft: 6,
              color: "var(--text-muted)",
            }}
          >
            · optional
          </span>
        ) : null}
      </label>
      {children}
      {hint ? <div className="help">{hint}</div> : null}
    </div>
  );
}
