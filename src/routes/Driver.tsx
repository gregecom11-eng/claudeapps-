import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  addRideExtra,
  claimDriverByEmail,
  getOrgSettings,
  listPassengerHistory,
  listRideEvents,
  listRideExtras,
  listRides,
  listVehicles,
  markDriverSeen,
  setDriverNotes,
  updateMyDriverSelf,
  updateMyProfile,
  updateRideStatus,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { useBigText } from "../lib/useBigText";
import { downloadICS } from "../lib/calendar";
import { BUSINESS_TZ, fmtDate, fmtMoney, fmtTime } from "../lib/format";
import {
  useRideExtrasRealtime,
  useRideRealtime,
} from "../lib/realtime";
import { Avatar } from "../components/Avatar";
import { Icon, type IconName } from "../components/Icon";
import { NotificationPrefs } from "../components/NotificationPrefs";
import { PushToggle } from "../components/PushToggle";
import { RideRowSkeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import type {
  ActivityEvent,
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

  const reload = useCallback(() => {
    const todayWindow = laDayBoundsFor();
    const tomorrowWindow = laDayBoundsFor(
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    );
    // Heartbeat — bumps drivers.last_seen_at so the owner can see in
    // Settings that the driver app is actively running. Soft-fails if
    // the migration hasn't been applied yet.
    void markDriverSeen();
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
  }, []);
  useEffect(() => {
    if (linked === "loading") return;
    reload();
  }, [linked, reload]);

  // Realtime — refresh when ANY ride visible to this driver changes.
  useRideRealtime(reload);

  // Broadcast the dispatcher-set driver name so the shell header can
  // show "Hey Mike" instead of falling back to the auth email.
  useEffect(() => {
    if (linked === "loading" || !linked) return;
    const name = driverDisplayName(linked, profile?.full_name);
    window.dispatchEvent(
      new CustomEvent("sdl:driver-name", { detail: { name } }),
    );
  }, [linked, profile?.full_name]);

  // Broadcast "any ride is in flight" so the bottom tab bar can show a
  // status dot on Today regardless of which tab is foregrounded.
  useEffect(() => {
    const active = (today ?? []).some(
      (r) =>
        r.status === "on_the_way" ||
        r.status === "arrived" ||
        r.status === "in_progress",
    );
    window.dispatchEvent(
      new CustomEvent("sdl:driver-active-ride", { detail: { active } }),
    );
  }, [today]);

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
          {firstName(driverDisplayName(linked, profile?.full_name))}'s day
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

      {today === null ? (
        <div className="space-y-3">
          <RideRowSkeleton />
          <RideRowSkeleton />
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
          nextRide={pickNextRide(today ?? [], activeRide)}
          onClose={() => setActiveRide(null)}
          onJumpToNext={() => {
            const next = pickNextRide(today ?? [], activeRide);
            if (next) setActiveRide(next);
          }}
          onChange={async (updates) => {
            // Status change
            if (updates.status) {
              try {
                const updated = await updateRideStatus(
                  activeRide.id,
                  updates.status,
                );
                // Tiny haptic confirmation when the device supports it.
                // No-op on desktop / iOS — purely a "your tap registered"
                // signal for drivers wearing gloves or in noisy cars.
                try {
                  navigator.vibrate?.(15);
                } catch {
                  /* not supported */
                }
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

// Pick the next un-finished ride after the given one (sorted by pickup
// time). Returns null when this is already the last of the day.
function pickNextRide(today: Ride[], current: Ride): Ride | null {
  const sorted = today
    .slice()
    .sort(
      (a, b) =>
        new Date(a.pickup_at).getTime() - new Date(b.pickup_at).getTime(),
    );
  const after = sorted.filter(
    (r) =>
      r.id !== current.id &&
      r.status !== "completed" &&
      r.status !== "cancelled" &&
      new Date(r.pickup_at).getTime() >= new Date(current.pickup_at).getTime(),
  );
  return after[0] ?? null;
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
  nextRide,
  onClose,
  onChange,
  onJumpToNext,
}: {
  ride: Ride;
  driver: DriverType;
  vehicle: Vehicle | null;
  nextRide: Ride | null;
  onClose: () => void;
  onChange: (updates: { status?: RideStatus }) => void;
  onJumpToNext: () => void;
}) {
  const [tab, setTab] = useState<SheetTab>("briefing");
  const [extras, setExtras] = useState<RideExtra[]>([]);
  const [extrasErr, setExtrasErr] = useState<string | null>(null);
  const [dispatchPhone, setDispatchPhone] = useState<string | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [history, setHistory] = useState<Ride[]>([]);
  const [draftDriverNotes, setDraftDriverNotes] = useState<string>(
    ride.driver_notes ?? "",
  );
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesMsg, setNotesMsg] = useState<string | null>(null);
  const [copyAllOk, setCopyAllOk] = useState(false);

  // Swipe-to-dismiss state. Only engages on touchscreens — refs avoid
  // re-renders mid-drag.
  const startY = useRef<number | null>(null);
  const dragY = useRef<number>(0);
  const sheetRef = useRef<HTMLDivElement | null>(null);

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
    listRideEvents(ride.id).then(setEvents).catch(() => {});
    listPassengerHistory(ride).then(setHistory).catch(() => setHistory([]));
    setDraftDriverNotes(ride.driver_notes ?? "");
  }, [ride.id, ride.driver_notes, ride]);

  const reloadExtras = () =>
    listRideExtras(ride.id).then(setExtras).catch(() => {});

  useRideExtrasRealtime(ride.id, reloadExtras);

  const mapsUrl = (addr: string) =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;

  // Map status → most-recent event timestamp from the activity log.
  const stamps = useMemo(() => {
    const m: Partial<Record<RideStatus, string>> = {};
    for (const e of events) {
      const meta = (e.metadata ?? {}) as { to?: RideStatus; status?: RideStatus };
      const to = meta.to ?? meta.status;
      if (to) m[to] = e.created_at;
    }
    return m;
  }, [events]);

  const copyAll = async () => {
    const lines = [
      `Pickup: ${ride.pickup_address}`,
      ride.dropoff_address ? `Dropoff: ${ride.dropoff_address}` : null,
      ride.passenger_name ? `Passenger: ${ride.passenger_name}` : null,
      ride.passenger_phone ? `Phone: ${ride.passenger_phone}` : null,
      `Pickup time: ${fmtDate(ride.pickup_at)} ${fmtTime(ride.pickup_at)} PT`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ text: lines, title: ride.passenger_name });
        return;
      }
      await navigator.clipboard.writeText(lines);
      setCopyAllOk(true);
      window.setTimeout(() => setCopyAllOk(false), 1600);
    } catch {
      /* user cancelled share — no-op */
    }
  };

  const saveDriverNotes = async () => {
    setSavingNotes(true);
    setNotesMsg(null);
    try {
      const v = draftDriverNotes.trim();
      await setDriverNotes(ride.id, v.length === 0 ? null : v);
      setNotesMsg("Saved");
      window.setTimeout(() => setNotesMsg(null), 1600);
    } catch (e) {
      setNotesMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingNotes(false);
    }
  };

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // Only engage swipe at the very top of the sheet — otherwise scrolling
    // long content would be blocked.
    if (sheetRef.current && sheetRef.current.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) return; // upward swipe — let it scroll
    dragY.current = dy;
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dy}px)`;
      sheetRef.current.style.transition = "none";
    }
  };
  const onTouchEnd = () => {
    if (startY.current === null) return;
    const dy = dragY.current;
    if (sheetRef.current) {
      sheetRef.current.style.transition = "transform 200ms ease";
      if (dy > 120) {
        // Far enough to dismiss.
        sheetRef.current.style.transform = `translateY(100%)`;
        window.setTimeout(onClose, 200);
      } else {
        sheetRef.current.style.transform = "translateY(0)";
      }
    }
    startY.current = null;
    dragY.current = 0;
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end md:items-center justify-center"
      style={{ background: "color-mix(in oklab, #000 50%, transparent)" }}
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        className="surface rounded-t-[16px] md:rounded-[16px] w-full md:max-w-[560px] max-h-[94vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        {/* Drag handle (purely visual; the whole top region is draggable). */}
        <div
          aria-hidden
          className="md:hidden flex justify-center pt-2 pb-1"
          style={{ background: "var(--surface)" }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 999,
              background: "var(--border)",
            }}
          />
        </div>

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

        {/* Status progress strip with timestamps */}
        <ProgressStrip status={ride.status} timestamps={stamps} />

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

            <div className="flex items-stretch gap-2">
              {dispatchPhone ? (
                <a
                  href={`sms:${dispatchPhone}?body=${encodeURIComponent(
                    `Re: ${ride.passenger_name} ride at ${fmtTime(ride.pickup_at)} — `,
                  )}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-[10px] h-11 text-[14px] font-medium"
                  style={{
                    background: "transparent",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Icon name="phone" size={14} /> Message dispatch
                </a>
              ) : null}
              <button
                onClick={copyAll}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] h-11 px-3 text-[13.5px] font-medium"
                style={{
                  background: "transparent",
                  color: copyAllOk ? "var(--success)" : "var(--text)",
                  border: "1px solid var(--border)",
                }}
                title="Copy or share pickup, dropoff, passenger, time"
              >
                <Icon name={copyAllOk ? "check" : "copy"} size={14} />
                {copyAllOk ? "Copied" : "Share trip"}
              </button>
            </div>

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

            {/* Passenger history (e.g. "5th ride · last Apr 12 · prefers Cadillac") */}
            <PassengerHistoryCard ride={ride} history={history} />

            {/* Wait-time helper (visible while at pickup or on the way) */}
            <WaitTimer
              rideId={ride.id}
              status={ride.status}
              onAdded={reloadExtras}
            />

            {/* Extras section */}
            <ExtrasSection
              rideId={ride.id}
              extras={extras}
              error={extrasErr}
              onChanged={reloadExtras}
            />

            {/* Driver-side notes (post-trip handoff) */}
            <DriverNotesCard
              draft={draftDriverNotes}
              onChange={setDraftDriverNotes}
              onSave={saveDriverNotes}
              saving={savingNotes}
              msg={notesMsg}
              dirty={(draftDriverNotes ?? "") !== (ride.driver_notes ?? "")}
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
          className="px-5 py-4 space-y-2 sticky bottom-0 no-print"
          style={{
            borderTop: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          {ride.status === "completed" && nextRide ? (
            <button
              onClick={onJumpToNext}
              className="w-full inline-flex items-center justify-between gap-2 rounded-[10px] h-12 px-4 text-[14px] font-semibold"
              style={{
                background: "var(--accent)",
                color: "#15161B",
                border: "1px solid var(--accent-strong)",
              }}
            >
              <span className="truncate">
                Next: {firstName(nextRide.passenger_name)} ·{" "}
                {fmtTime(nextRide.pickup_at)}
              </span>
              <Icon name="arrow" size={16} />
            </button>
          ) : (
            <ActionBar
              status={ride.status}
              onAdvance={(s) => onChange({ status: s })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressStrip({
  status,
  timestamps,
}: {
  status: RideStatus;
  timestamps?: Partial<Record<RideStatus, string>>;
}) {
  const STEPS: { key: RideStatus; label: string }[] = [
    { key: "scheduled", label: "Booked" },
    { key: "on_the_way", label: "Rolling" },
    { key: "arrived", label: "At pickup" },
    { key: "in_progress", label: "On board" },
    { key: "completed", label: "Done" },
  ];
  const currentIdx = STEPS.findIndex((s) => s.key === status);
  const idx = status === "cancelled" ? -1 : currentIdx;
  const activeTime =
    currentIdx >= 0 ? timestamps?.[STEPS[currentIdx].key] : null;

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
        className="mt-1.5 grid"
        style={{
          gridTemplateColumns: `repeat(${STEPS.length}, 1fr)`,
          gap: 6,
        }}
      >
        {STEPS.map((s, i) => {
          const done = idx > i;
          const active = idx === i;
          return (
            <div
              key={s.key}
              className="tnum"
              style={{
                fontSize: 10.5,
                letterSpacing: "0.02em",
                textAlign: "center",
                color: done || active ? "var(--text)" : "var(--text-muted)",
                fontWeight: active ? 600 : 500,
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={s.label}
            >
              {s.label}
            </div>
          );
        })}
      </div>
      <div
        className="mt-2 text-muted flex items-center justify-between gap-3"
        style={{ fontSize: 11.5, letterSpacing: "0.02em" }}
      >
        <span>
          {status === "cancelled"
            ? "Ride cancelled"
            : currentIdx >= 0
            ? STEPS[currentIdx].label
            : "Pending"}
        </span>
        {activeTime ? (
          <span className="tnum">{fmtTime(activeTime)}</span>
        ) : null}
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
  // Action button label = the *next* status. Kept short so they don't
  // wrap on small screens and read clearly when stressed.
  const labels: Record<RideStatus, string> = {
    requested: "",
    scheduled: "On my way",
    on_the_way: "I'm here",
    arrived: "Passenger on board",
    in_progress: "Trip complete",
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

/* ── Passenger history (Nth ride · last on …) ───────────────── */
function PassengerHistoryCard({
  ride,
  history,
}: {
  ride: Ride;
  history: Ride[];
}) {
  if (history.length === 0) return null;
  const last = history[0];
  const total = history.length + 1;
  // Most-frequent vehicle in their past (by id, no display name lookup —
  // we surface the count and let the briefing's vehicle row show the name).
  const vehicleCounts = new Map<string, number>();
  for (const r of history) {
    if (r.vehicle_id)
      vehicleCounts.set(
        r.vehicle_id,
        (vehicleCounts.get(r.vehicle_id) ?? 0) + 1,
      );
  }
  const favoriteVehicle = ride.vehicle_id
    ? null
    : [...vehicleCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  void favoriteVehicle; // future: thread vehiclesById in here for a name
  return (
    <div
      className="rounded-[10px] p-3 flex items-start gap-3"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        className="inline-grid place-items-center mt-0.5 text-accent shrink-0"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <Icon name="user" size={13} />
      </span>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          Ride #{total} with {firstName(ride.passenger_name)}
        </div>
        <div
          className="text-muted"
          style={{ fontSize: 12, lineHeight: 1.5, marginTop: 2 }}
        >
          Last completed {fmtDate(last.pickup_at)} · {fmtTime(last.pickup_at)}
        </div>
      </div>
    </div>
  );
}

/* ── Wait-time helper (start a clock, stop and add to extras) ─── */
function WaitTimer({
  rideId,
  status,
  onAdded,
}: {
  rideId: string;
  status: RideStatus;
  onAdded: () => void;
}) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [confirming, setConfirming] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (startedAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  // Only useful between "on the way" and "in progress" — once on board
  // there's no waiting to bill.
  if (
    status !== "arrived" &&
    status !== "on_the_way" &&
    status !== "scheduled"
  )
    return null;

  const elapsedMs = startedAt ? now - startedAt : 0;
  const elapsedMin = Math.max(1, Math.round(elapsedMs / 60_000));
  const mm = Math.floor(elapsedMs / 60_000);
  const ss = Math.floor((elapsedMs % 60_000) / 1000);

  const start = () => {
    setStartedAt(Date.now());
    setErr(null);
  };
  const cancel = () => {
    setStartedAt(null);
    setConfirming(false);
    setAmount("");
  };
  const stopAndConfirm = () => {
    setConfirming(true);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const cents = Math.round(parseFloat(amount || "0") * 100) || 0;
      await addRideExtra(
        rideId,
        `Wait time · ${elapsedMin} min`,
        cents,
      );
      cancel();
      onAdded();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-[10px] p-3"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="inline-grid place-items-center text-accent shrink-0"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <Icon name="clock" size={13} />
        </span>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {startedAt ? "Wait time running" : "Wait time"}
          </div>
          <div
            className="text-muted tnum"
            style={{ fontSize: 12, marginTop: 2 }}
          >
            {startedAt
              ? `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
              : "Tap start when you arrive at pickup and the clock is on you."}
          </div>
        </div>
        {!startedAt ? (
          <button
            onClick={start}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12.5px] font-semibold"
            style={{
              background: "var(--accent)",
              color: "#15161B",
              border: "1px solid var(--accent-strong)",
            }}
          >
            <Icon name="clock" size={12} /> Start
          </button>
        ) : (
          <button
            onClick={confirming ? cancel : stopAndConfirm}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12.5px] font-medium"
            style={{
              background: "transparent",
              color: "var(--text)",
              border: "1px solid var(--border)",
            }}
          >
            {confirming ? "Cancel" : "Stop"}
          </button>
        )}
      </div>

      {confirming ? (
        <form onSubmit={submit} className="mt-3 grid gap-2">
          <div
            className="text-muted"
            style={{ fontSize: 12, lineHeight: 1.5 }}
          >
            Adds an extra "Wait time · {elapsedMin} min" line to the ride.
          </div>
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
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^0-9.]/g, ""))
                }
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={busy}
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
          {err ? (
            <div className="text-danger" style={{ fontSize: 12 }}>
              {err}
            </div>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

/* ── Driver-side notes (post-trip handoff) ──────────────────── */
function DriverNotesCard({
  draft,
  onChange,
  onSave,
  saving,
  msg,
  dirty,
}: {
  draft: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  msg: string | null;
  dirty: boolean;
}) {
  return (
    <div
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
          My notes for next time
        </div>
        {msg ? (
          <span
            className="text-success"
            style={{ fontSize: 11.5, fontWeight: 500 }}
          >
            {msg}
          </span>
        ) : null}
      </div>
      <textarea
        className="field"
        placeholder="e.g. Address is around the back · prefers cold water · gate code 1234"
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        style={{ minHeight: 70 }}
      />
      <div className="mt-2 flex justify-end">
        <button
          onClick={onSave}
          disabled={saving || !dirty}
          className="inline-flex items-center justify-center gap-2 h-9 px-3 rounded-[8px] text-[13px] font-medium disabled:opacity-50"
          style={{
            background: dirty ? "var(--accent)" : "transparent",
            color: dirty ? "#15161B" : "var(--text-muted)",
            border: `1px solid ${
              dirty ? "var(--accent-strong)" : "var(--border)"
            }`,
            cursor: saving ? "wait" : "pointer",
          }}
        >
          <Icon name="save" size={13} />
          {saving ? "Saving…" : dirty ? "Save notes" : "Saved"}
        </button>
      </div>
    </div>
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
        className="text-muted no-print"
        style={{ fontSize: 12, lineHeight: 1.5 }}
      >
        Show this to law enforcement if requested. It's a DOT-style trip
        ticket with no client billing details exposed.
      </div>
      <div
        className="waybill-print rounded-[8px] p-4 mono"
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
      <div className="grid grid-cols-2 gap-2 no-print">
        <button
          onClick={onCopy}
          className="inline-flex items-center justify-center gap-2 rounded-[10px] h-10 text-[13.5px] font-medium"
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            color: copied ? "var(--success)" : "var(--text)",
          }}
        >
          <Icon name={copied ? "check" : "copy"} size={14} />
          {copied ? "Copied" : "Copy text"}
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-2 rounded-[10px] h-10 text-[13.5px] font-medium"
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
          title="Open the system print dialog (paper or PDF)"
        >
          <Icon name="doc" size={14} />
          Print
        </button>
      </div>
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

// What to call the driver in greetings. Prefer the dispatcher-set
// `drivers.full_name` because the auth profile's full_name silently
// falls back to the email when sign-up metadata wasn't supplied
// (see handle_new_user trigger in schema.sql) — and "you@example.com"
// is a terrible thing to greet someone with.
function looksLikeEmail(s: string | null | undefined): boolean {
  return !!s && /\S+@\S+\.\S+/.test(s);
}
function driverDisplayName(
  linked: DriverType | null,
  profileName: string | null | undefined,
): string {
  if (linked?.full_name && linked.full_name.trim().length > 0) {
    return linked.full_name;
  }
  if (profileName && !looksLikeEmail(profileName)) return profileName;
  return "Driver";
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

type PastFilter = "completed" | "cancelled";

export function DriverPast() {
  const [rides, setRides] = useState<Ride[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PastFilter>("completed");
  const [search, setSearch] = useState("");

  useEffect(() => {
    // Pull a generous window so the weekly card is meaningful.
    Promise.all([listRides({ limit: 250 }), listVehicles()])
      .then(([r, v]) => {
        const past = r
          .filter(
            (x) =>
              x.status === "completed" ||
              x.status === "cancelled" ||
              new Date(x.pickup_at).getTime() < Date.now(),
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

  const counts = useMemo(() => {
    const all = rides ?? [];
    return {
      completed: all.filter((r) => r.status === "completed").length,
      cancelled: all.filter((r) => r.status === "cancelled").length,
    };
  }, [rides]);

  const filtered = useMemo(() => {
    const all = rides ?? [];
    const byStatus = all.filter((r) =>
      filter === "completed"
        ? r.status === "completed"
        : r.status === "cancelled",
    );
    const q = search.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter((r) => {
      const v = r.vehicle_id ? vMap.get(r.vehicle_id) : null;
      const blob = [
        r.passenger_name,
        r.pickup_address,
        r.dropoff_address ?? "",
        r.flight_number ?? "",
        r.flight_airline ?? "",
        r.flight_airport ?? "",
        v?.display_name ?? "",
        v?.plate ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rides, filter, search, vMap]);

  const grouped = useMemo(() => groupByPastWeek(filtered), [filtered]);

  // Earnings dashboard — completed rides bucketed by time window. The
  // hero card always renders so the driver isn't staring at a blank
  // page on a fresh account; an empty state nudges them to keep going.
  const earnings = useMemo(() => {
    const all = (rides ?? []).filter((r) => r.status === "completed");
    const thisStart = startOfThisWeekLA();
    const lastStart = new Date(
      thisStart.getTime() - 7 * 24 * 60 * 60 * 1000,
    );
    const monthStart = startOfThisMonthLA();
    const totals = (list: Ride[]) => ({
      count: list.length,
      fares: list.reduce((s, r) => s + (r.fare_cents ?? 0), 0),
      tips: list.reduce((s, r) => s + (r.gratuity_cents ?? 0), 0),
      parking: list.reduce((s, r) => s + (r.parking_cents ?? 0), 0),
      gross: list.reduce((s, r) => s + (r.total_cents ?? 0), 0),
    });
    return {
      thisWeek: totals(
        all.filter((r) => new Date(r.pickup_at) >= thisStart),
      ),
      lastWeek: totals(
        all.filter(
          (r) =>
            new Date(r.pickup_at) >= lastStart &&
            new Date(r.pickup_at) < thisStart,
        ),
      ),
      thisMonth: totals(
        all.filter((r) => new Date(r.pickup_at) >= monthStart),
      ),
      allTime: totals(all),
    };
  }, [rides]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="text-muted hover:text-text"
          style={{ fontSize: 12.5 }}
        >
          <Icon name="back" size={13} /> Today
        </Link>
      </div>
      <div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          Earnings
        </h1>
        <p
          className="text-muted mt-1"
          style={{ fontSize: 13.5, lineHeight: 1.5 }}
        >
          {earnings.allTime.count === 0
            ? "Once you mark rides complete, your tally lives here."
            : `${earnings.allTime.count} completed ${
                earnings.allTime.count === 1 ? "ride" : "rides"
              } · ${fmtMoney(earnings.allTime.gross)} all time.`}
        </p>
      </div>

      {error ? <div className="text-danger text-sm">{error}</div> : null}

      <EarningsHero
        loading={rides === null}
        thisWeek={earnings.thisWeek}
        lastWeek={earnings.lastWeek}
      />

      <ComparisonRow
        lastWeek={earnings.lastWeek}
        thisMonth={earnings.thisMonth}
        allTime={earnings.allTime}
      />

      <div>
        <h2
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Trip history
        </h2>

        <PastSearchAndFilter
          search={search}
          onSearch={setSearch}
          filter={filter}
          onFilter={setFilter}
          counts={counts}
        />
      </div>

      {rides === null ? (
        <div className="text-muted text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div
          className="surface rounded-[12px] p-6 text-center"
          style={{ fontSize: 13.5 }}
        >
          <div
            className="text-muted"
            style={{ fontSize: 13.5, lineHeight: 1.6 }}
          >
            {search.trim()
              ? "No rides match this search."
              : filter === "cancelled"
              ? "No cancelled rides on record — nice."
              : "No completed rides yet. Once you finish a trip and tap Complete, it'll show up here with the fare and tip."}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ key, label, items }) => (
            <section key={key}>
              <div className="flex items-center gap-3 mb-2">
                <h2
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  {label}
                </h2>
                <span
                  className="text-muted tnum"
                  style={{ fontSize: 11.5 }}
                >
                  {items.length} {items.length === 1 ? "ride" : "rides"}
                </span>
                <div
                  className="flex-1 h-px"
                  style={{ background: "var(--border)" }}
                />
                {filter === "completed" ? (
                  <span
                    className="tnum"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {fmtMoney(
                      items.reduce(
                        (s, r) => s + (r.total_cents ?? 0),
                        0,
                      ),
                    )}
                  </span>
                ) : null}
              </div>
              <ul className="surface rounded-[12px] divide-y divide-border">
                {items.map((r) => {
                  const v = r.vehicle_id ? vMap.get(r.vehicle_id) : null;
                  return (
                    <li
                      key={r.id}
                      className="px-4 py-3 flex items-center gap-3"
                    >
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
                      {filter === "completed" ? (
                        <div
                          className="tnum text-right shrink-0"
                          style={{ fontSize: 13.5, fontWeight: 600 }}
                        >
                          {fmtMoney(r.total_cents ?? 0)}
                          {(r.gratuity_cents ?? 0) > 0 ? (
                            <div
                              className="text-muted"
                              style={{ fontSize: 11, fontWeight: 500 }}
                            >
                              tip {fmtMoney(r.gratuity_cents)}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <StatusBadge status={r.status} />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

type EarningsBucket = {
  count: number;
  fares: number;
  tips: number;
  parking: number;
  gross: number;
};

// Hero "this week" card: huge gross-earnings number plus a four-up
// breakdown (rides / fares / tips / parking) and a delta vs last week.
// Always renders so a fresh test driver still sees something useful.
function EarningsHero({
  loading,
  thisWeek,
  lastWeek,
}: {
  loading: boolean;
  thisWeek: EarningsBucket;
  lastWeek: EarningsBucket;
}) {
  const delta = thisWeek.gross - lastWeek.gross;
  const showDelta = lastWeek.gross > 0 || lastWeek.count > 0;
  const deltaPositive = delta >= 0;
  return (
    <div
      className="rounded-[14px] p-5 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--accent) 18%, var(--surface)) 0%, var(--surface) 70%)",
        border: "1px solid color-mix(in oklab, var(--accent) 35%, var(--border))",
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div
          className="text-muted"
          style={{
            fontSize: 11.5,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          This week
        </div>
        {showDelta && !loading ? (
          <span
            className="chip tnum"
            title={
              deltaPositive
                ? `${fmtMoney(delta)} more than last week`
                : `${fmtMoney(Math.abs(delta))} less than last week`
            }
            style={{
              background: "transparent",
              color: deltaPositive ? "var(--success)" : "var(--text-muted)",
              borderColor: deltaPositive
                ? "color-mix(in oklab, var(--success) 50%, var(--border))"
                : "var(--border)",
              fontSize: 11.5,
            }}
          >
            <span
              style={{
                display: "inline-block",
                transform: deltaPositive ? "none" : "rotate(180deg)",
              }}
            >
              ↑
            </span>
            {deltaPositive ? "+" : "−"}
            {fmtMoney(Math.abs(delta))} vs last
          </span>
        ) : null}
      </div>
      <div
        className="tnum"
        style={{
          fontSize: 40,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
        }}
      >
        {loading ? "—" : fmtMoney(thisWeek.gross)}
      </div>
      <div
        className="text-muted mt-1"
        style={{ fontSize: 13, lineHeight: 1.5 }}
      >
        {loading
          ? "Loading…"
          : thisWeek.count === 0
          ? "No completed rides yet this week — your hero number lives here."
          : `${thisWeek.count} ${
              thisWeek.count === 1 ? "ride" : "rides"
            } · ${fmtMoney(thisWeek.fares)} fares · ${fmtMoney(
              thisWeek.tips,
            )} tips`}
      </div>
      <div
        className="mt-4 grid"
        style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}
      >
        <MiniStat
          label={thisWeek.count === 1 ? "ride" : "rides"}
          value={String(thisWeek.count)}
        />
        <MiniStat label="fares" value={fmtMoney(thisWeek.fares)} />
        <MiniStat label="tips" value={fmtMoney(thisWeek.tips)} />
        <MiniStat label="parking" value={fmtMoney(thisWeek.parking)} />
      </div>
    </div>
  );
}

function ComparisonRow({
  lastWeek,
  thisMonth,
  allTime,
}: {
  lastWeek: EarningsBucket;
  thisMonth: EarningsBucket;
  allTime: EarningsBucket;
}) {
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}
    >
      <CompareTile
        label="Last week"
        bucket={lastWeek}
      />
      <CompareTile
        label="This month"
        bucket={thisMonth}
      />
      <CompareTile
        label="All time"
        bucket={allTime}
      />
    </div>
  );
}

function CompareTile({
  label,
  bucket,
}: {
  label: string;
  bucket: EarningsBucket;
}) {
  return (
    <div
      className="rounded-[12px] p-3"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="text-muted"
        style={{
          fontSize: 10.5,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        className="tnum mt-1.5"
        style={{
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        {fmtMoney(bucket.gross)}
      </div>
      <div
        className="text-muted tnum"
        style={{ fontSize: 11, marginTop: 2 }}
      >
        {bucket.count} {bucket.count === 1 ? "ride" : "rides"}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="tnum"
        style={{
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
        }}
      >
        {value}
      </div>
      <div
        className="text-muted"
        style={{ fontSize: 11, marginTop: 1, letterSpacing: "0.02em" }}
      >
        {label}
      </div>
    </div>
  );
}

function PastSearchAndFilter({
  search,
  onSearch,
  filter,
  onFilter,
  counts,
}: {
  search: string;
  onSearch: (s: string) => void;
  filter: PastFilter;
  onFilter: (f: PastFilter) => void;
  counts: { completed: number; cancelled: number };
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          style={{ pointerEvents: "none" }}
        >
          <Icon name="search" size={14} />
        </span>
        <input
          className="field field-prefixed"
          placeholder="Search passenger, address, flight…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        {search ? (
          <button
            onClick={() => onSearch("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-grid place-items-center text-muted hover:text-text"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
            }}
          >
            <Icon name="x" size={13} />
          </button>
        ) : null}
      </div>
      <div className="flex gap-2 overflow-x-auto" role="tablist">
        {(["completed", "cancelled"] as const).map((k) => {
          const active = filter === k;
          const n = k === "completed" ? counts.completed : counts.cancelled;
          return (
            <button
              key={k}
              role="tab"
              aria-selected={active}
              onClick={() => onFilter(k)}
              className="chip shrink-0"
              style={{
                cursor: "pointer",
                background: active ? "var(--accent)" : "transparent",
                color: active ? "#15161B" : "var(--text)",
                borderColor: active ? "var(--accent-strong)" : "var(--border)",
                fontWeight: active ? 600 : 500,
              }}
            >
              {k === "completed" ? "Completed" : "Cancelled"}
              <span
                className="tnum"
                style={{ fontSize: 11, opacity: 0.7 }}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── LA-time month helper (1st of the current month, 00:00) ───── */
function startOfThisMonthLA(): Date {
  const now = new Date();
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
  })
    .format(now); // "2026-05"
  const off = laOffsetFor(now);
  return new Date(`${ymd}-01T00:00:00${off}`);
}

/* ── LA-time week helpers (Mon → Sun) ─────────────────────────── */
function startOfThisWeekLA(): Date {
  const now = new Date();
  const dayName = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    weekday: "long",
  }).format(now);
  const idx: Record<string, number> = {
    Sunday: 6,
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
  };
  const daysSinceMonday = idx[dayName] ?? 0;
  const target = new Date(
    now.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000,
  );
  const dayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(target);
  const off = laOffsetFor(now);
  return new Date(`${dayStr}T00:00:00${off}`);
}

type WeekGroup = { key: string; label: string; items: Ride[] };

function groupByPastWeek(rides: Ride[]): WeekGroup[] {
  const thisStart = startOfThisWeekLA();
  const lastStart = new Date(thisStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const out: { thisWk: Ride[]; lastWk: Ride[]; earlier: Ride[] } = {
    thisWk: [],
    lastWk: [],
    earlier: [],
  };
  for (const r of rides) {
    const t = new Date(r.pickup_at);
    if (t >= thisStart) out.thisWk.push(r);
    else if (t >= lastStart) out.lastWk.push(r);
    else out.earlier.push(r);
  }
  const groups: WeekGroup[] = [];
  if (out.thisWk.length)
    groups.push({ key: "this", label: "This week", items: out.thisWk });
  if (out.lastWk.length)
    groups.push({ key: "last", label: "Last week", items: out.lastWk });
  if (out.earlier.length)
    groups.push({ key: "earlier", label: "Earlier", items: out.earlier });
  return groups;
}

export function DriverProfile() {
  const { profile, session } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [driver, setDriver] = useState<DriverType | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [available, setAvailable] = useState<boolean>(true);
  const [defaultVehicleId, setDefaultVehicleId] = useState<string | null>(
    null,
  );
  const [savingDriver, setSavingDriver] = useState(false);

  useEffect(() => {
    setName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile?.full_name, profile?.phone]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([claimDriverByEmail(), listVehicles()])
      .then(([d, v]) => {
        if (cancelled) return;
        setDriver(d);
        setVehicles(v);
        setAvailable(d?.available ?? true);
        setDefaultVehicleId(d?.default_vehicle_id ?? null);
      })
      .catch(() => {
        /* migration may not be applied; the controls still render but
           save attempts will surface an error */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const flash = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 2000);
  };

  const toggleAvailability = async (next: boolean) => {
    setAvailable(next); // optimistic
    setSavingDriver(true);
    try {
      const updated = await updateMyDriverSelf({ available: next });
      if (updated) setDriver(updated);
      flash(next ? "Back on duty" : "Off duty — dispatch will see");
    } catch (e) {
      setAvailable(!next);
      flash(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSavingDriver(false);
    }
  };

  const setVehicleDefault = async (next: string | null) => {
    setDefaultVehicleId(next); // optimistic
    setSavingDriver(true);
    try {
      const updated = await updateMyDriverSelf({ default_vehicle_id: next });
      if (updated) setDriver(updated);
      flash("Default vehicle saved");
    } catch (e) {
      setDefaultVehicleId(driver?.default_vehicle_id ?? null);
      flash(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSavingDriver(false);
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
        <div className="min-w-0 flex-1">
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
        <DutyChip available={available} />
      </div>

      <DutyCard
        available={available}
        saving={savingDriver}
        onToggle={toggleAvailability}
      />

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
        <Field
          label="Default vehicle"
          hint="Dispatch sees this preference when assigning your rides."
          optional
        >
          <select
            className="field"
            value={defaultVehicleId ?? ""}
            onChange={(e) =>
              setVehicleDefault(e.target.value === "" ? null : e.target.value)
            }
            disabled={savingDriver || vehicles.length === 0}
          >
            <option value="">No preference</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.display_name}
                {v.plate ? ` · ${v.plate}` : ""}
              </option>
            ))}
          </select>
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

      <PushToggle hint="Get a heads-up 90 minutes before each ride. Tap a notification to jump to the briefing." />

      <BigTextCard />

      <div
        className="surface rounded-[12px]"
        style={{ overflow: "hidden" }}
      >
        <div
          className="px-4 pt-3 pb-2"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div
            className="text-muted"
            style={{
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            What pings you
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
            Notification preferences
          </div>
        </div>
        <NotificationPrefs
          role="driver"
          flash={(m) => {
            setMsg(m);
            window.setTimeout(() => setMsg(null), 2400);
          }}
        />
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

/* ── Big-text accessibility toggle ───────────────────────────── */
function BigTextCard() {
  const [on, setOn] = useBigText();
  return (
    <div
      className="surface rounded-[12px] p-4 flex items-center gap-3"
      style={{ border: "1px solid var(--border)" }}
    >
      <span
        className="inline-grid place-items-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: on ? "var(--accent)" : "var(--text-muted)",
          fontWeight: 700,
          fontSize: 15,
          flexShrink: 0,
        }}
      >
        Aa
      </span>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 14, fontWeight: 600 }}>Bigger text</div>
        <div
          className="text-muted"
          style={{ fontSize: 12, lineHeight: 1.5 }}
        >
          Scales the whole app up about 12% — easier to read in glare or
          when wearing readers. Saved to this device.
        </div>
      </div>
      <button
        role="switch"
        aria-checked={on}
        onClick={() => setOn(!on)}
        className="relative shrink-0"
        style={{
          width: 40,
          height: 24,
          borderRadius: 999,
          background: on ? "var(--accent)" : "var(--surface-2)",
          border: `1px solid ${on ? "var(--accent-strong)" : "var(--border)"}`,
          cursor: "pointer",
          transition: "background 120ms ease, border-color 120ms ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: on ? 18 : 2,
            width: 18,
            height: 18,
            borderRadius: 999,
            background: on ? "#15161B" : "var(--text-muted)",
            transition: "left 140ms ease",
          }}
        />
      </button>
    </div>
  );
}

/* ── Duty card + chip ──────────────────────────────────────────── */
function DutyChip({ available }: { available: boolean }) {
  const color = available ? "var(--success)" : "var(--text-muted)";
  return (
    <span
      className="chip tnum shrink-0"
      style={{ color, background: "transparent" }}
      title={available ? "Available for new rides" : "Off duty"}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
          display: "inline-block",
        }}
      />
      {available ? "On duty" : "Off duty"}
    </span>
  );
}

function DutyCard({
  available,
  saving,
  onToggle,
}: {
  available: boolean;
  saving: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div
      className="surface rounded-[12px] p-4 flex items-center gap-3"
      style={{ border: "1px solid var(--border)" }}
    >
      <span
        className="inline-grid place-items-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: available ? "var(--success)" : "var(--text-muted)",
          flexShrink: 0,
        }}
      >
        <Icon name={available ? "check" : "moon"} size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {available ? "Available for new rides" : "Off duty"}
        </div>
        <div
          className="text-muted"
          style={{ fontSize: 12, lineHeight: 1.5 }}
        >
          {available
            ? "Dispatch can assign new rides to you. Flip this off if you're sick, your vehicle is in the shop, or you're done for the day."
            : "Dispatch can see you're off duty and won't assign you new rides. Existing rides stay on your schedule."}
        </div>
      </div>
      <button
        role="switch"
        aria-checked={available}
        disabled={saving}
        onClick={() => onToggle(!available)}
        className="relative shrink-0"
        style={{
          width: 40,
          height: 24,
          borderRadius: 999,
          background: available ? "var(--success)" : "var(--surface-2)",
          border: `1px solid ${
            available
              ? "color-mix(in oklab, var(--success) 60%, var(--border))"
              : "var(--border)"
          }`,
          opacity: saving ? 0.6 : 1,
          cursor: saving ? "wait" : "pointer",
          transition: "background 120ms ease, border-color 120ms ease",
        }}
        title={available ? "Tap to go off duty" : "Tap to go on duty"}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: available ? 18 : 2,
            width: 18,
            height: 18,
            borderRadius: 999,
            background: available ? "#15161B" : "var(--text-muted)",
            transition: "left 140ms ease",
          }}
        />
      </button>
    </div>
  );
}
