import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteRide,
  getRide,
  listClients,
  listDrivers,
  listVehicles,
  upsertRide,
} from "../lib/api";
import { dollarsToCents } from "../lib/format";
import { Avatar } from "../components/Avatar";
import { Icon, type IconName } from "../components/Icon";
import type {
  BillingTerms,
  Client,
  Driver,
  Ride,
  RideStatus,
  Vehicle,
} from "../lib/types";

type FormState = {
  passenger_name: string;
  passenger_phone: string;
  client_id: string;
  pickup_date: string;     // yyyy-mm-dd
  pickup_time: string;     // HH:MM
  pickup_address: string;
  dropoff_address: string;
  flight_airline: string;
  flight_number: string;
  flight_airport: string;
  flight_terminal: string;
  driver_id: string;
  vehicle_id: string;
  fare: string;
  gratuity: string;
  parking: string;
  billing_terms: BillingTerms | "";
  status: RideStatus;
  notes: string;
};

const TODAY = new Date();
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const EMPTY: FormState = {
  passenger_name: "",
  passenger_phone: "",
  client_id: "",
  pickup_date: isoDate(TODAY),
  pickup_time: "09:00",
  pickup_address: "",
  dropoff_address: "",
  flight_airline: "",
  flight_number: "",
  flight_airport: "LAX",
  flight_terminal: "",
  driver_id: "",
  vehicle_id: "",
  fare: "",
  gratuity: "",
  parking: "",
  billing_terms: "",
  status: "scheduled",
  notes: "",
};

const TERMS: { id: BillingTerms; label: string }[] = [
  { id: "cash", label: "Cash" },
  { id: "card", label: "Card" },
  { id: "zelle", label: "Zelle" },
  { id: "net_15", label: "Net 15" },
  { id: "net_30", label: "Net 30" },
  { id: "company_billing", label: "Company" },
];

const PICKUP_SUGGESTIONS = [
  "Bel Air Residence",
  "Four Seasons Beverly Hills",
  "The Beverly Hilton",
  "Goldman Sachs · 2029 Century Park E",
];
const DROP_SUGGESTIONS = [
  "LAX · Tom Bradley Intl · Terminal B",
  "Van Nuys VNY · Private Aviation",
  "Soho House West Hollywood",
  "Hollywood Bowl — VIP Entrance",
];

const AIRPORTS = ["LAX", "VNY", "BUR", "LGB", "SNA"];

export function RideForm() {
  const { id } = useParams<{ id?: string }>();
  const editing = Boolean(id && id !== "new");
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [clients, setClients] = useState<Client[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [flightOpen, setFlightOpen] = useState(false);

  useEffect(() => {
    Promise.all([listClients(), listDrivers(), listVehicles()]).then(
      ([c, d, v]) => {
        setClients(c);
        setDrivers(d);
        setVehicles(v);
        if (!editing) {
          setForm((f) => ({
            ...f,
            driver_id: d[0]?.id ?? "",
            vehicle_id: v[0]?.id ?? "",
          }));
        }
      },
    );
    if (editing && id) {
      getRide(id)
        .then((r) => {
          if (r) {
            setForm(rideToForm(r));
            if (r.flight_number || r.flight_airline) setFlightOpen(true);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [editing, id]);

  const total = useMemo(() => {
    const n = (s: string) => parseFloat(s || "0") || 0;
    return n(form.fare) + n(form.gratuity) + n(form.parking);
  }, [form.fare, form.gratuity, form.parking]);

  const isValid =
    form.passenger_name.trim() &&
    form.pickup_date &&
    form.pickup_time &&
    form.pickup_address.trim();

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (generatePacket: boolean) => {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      const pickupISO = new Date(
        `${form.pickup_date}T${form.pickup_time}`,
      ).toISOString();
      const payload: Partial<Ride> = {
        ...(editing && id ? { id } : {}),
        passenger_name: form.passenger_name.trim(),
        passenger_phone: form.passenger_phone.trim() || null,
        client_id: form.client_id || null,
        pickup_at: pickupISO,
        pickup_address: form.pickup_address.trim(),
        dropoff_address: form.dropoff_address.trim() || null,
        flight_airline: form.flight_airline.trim() || null,
        flight_number: form.flight_number.trim() || null,
        flight_airport: form.flight_airport.trim() || null,
        flight_terminal: form.flight_terminal.trim() || null,
        driver_id: form.driver_id || null,
        vehicle_id: form.vehicle_id || null,
        fare_cents: dollarsToCents(form.fare || "0"),
        gratuity_cents: dollarsToCents(form.gratuity || "0"),
        parking_cents: dollarsToCents(form.parking || "0"),
        billing_terms: form.billing_terms || null,
        status: form.status,
        notes: form.notes.trim() || null,
      };
      const saved = await upsertRide(payload);
      navigate(generatePacket ? `/rides/${saved.id}` : "/rides");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!id || id === "new") return;
    if (!confirm("Delete this ride? This cannot be undone.")) return;
    try {
      await deleteRide(id);
      navigate("/rides");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (loading) return <div className="text-muted">Loading…</div>;

  const fmtMoney = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="-mx-4 md:-mx-6 -mt-6 md:-mt-8">
      {/* Page heading inside main */}
      <div className="mx-auto w-full max-w-[760px] px-4 md:px-6 pt-6 md:pt-7">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="min-w-0">
            <Link
              to="/rides"
              className="inline-flex items-center gap-1.5 text-muted hover:text-text"
              style={{ fontSize: 12.5 }}
            >
              <Icon name="back" size={13} /> All rides
            </Link>
            <h1
              className="mt-1.5"
              style={{
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              {editing ? "Edit ride" : "New ride"}
            </h1>
            <p
              className="text-muted mt-1"
              style={{ fontSize: 13.5, lineHeight: 1.5 }}
            >
              Fill what you have. Pickup time + address + passenger name are
              the only required fields.
            </p>
          </div>
          {editing ? (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center justify-center h-9 px-3 rounded-[8px] text-[13px] font-medium"
              style={{
                background: "transparent",
                color: "var(--danger)",
                border: "1px solid var(--border)",
              }}
            >
              <Icon name="x" size={14} /> Delete
            </button>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 pb-32">
          <Section
            icon="user"
            title="Passenger"
            subtitle="Pick a repeat client or type a new one."
            step={1}
            total={7}
          >
            <Field label="Name">
              <ClientPicker
                value={form.passenger_name}
                onChange={(v) => update("passenger_name", v)}
                onPick={(c) => {
                  setForm((f) => ({
                    ...f,
                    passenger_name: c.name,
                    passenger_phone: c.phone ?? f.passenger_phone,
                    client_id: c.id,
                    billing_terms:
                      c.default_billing ?? f.billing_terms,
                  }));
                }}
                clients={clients}
              />
            </Field>
            <Field label="Phone" optional hint="Used for SMS confirmations">
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  style={{ pointerEvents: "none" }}
                >
                  <Icon name="phone" size={15} />
                </span>
                <input
                  className="field field-prefixed tnum"
                  placeholder="+1 (___) ___-____"
                  value={form.passenger_phone}
                  onChange={(e) => update("passenger_phone", e.target.value)}
                />
              </div>
            </Field>
          </Section>

          <Section
            icon="pin"
            title="Pickup"
            subtitle="When and where to collect the passenger."
            step={2}
            total={7}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    style={{ pointerEvents: "none" }}
                  >
                    <Icon name="calendar" size={15} />
                  </span>
                  <input
                    type="date"
                    className="field field-prefixed tnum"
                    value={form.pickup_date}
                    onChange={(e) => update("pickup_date", e.target.value)}
                  />
                </div>
              </Field>
              <Field label="Time">
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    style={{ pointerEvents: "none" }}
                  >
                    <Icon name="clock" size={15} />
                  </span>
                  <input
                    type="time"
                    className="field field-prefixed tnum"
                    value={form.pickup_time}
                    onChange={(e) => update("pickup_time", e.target.value)}
                  />
                </div>
              </Field>
            </div>
            <Field label="Pickup address">
              <AddressInput
                value={form.pickup_address}
                onChange={(v) => update("pickup_address", v)}
                placeholder="Search address or paste"
                suggestions={PICKUP_SUGGESTIONS}
              />
            </Field>
          </Section>

          <Section
            icon="flag"
            title="Dropoff"
            subtitle="Where the ride ends."
            step={3}
            total={7}
            action={
              <button
                type="button"
                aria-label="Swap pickup and dropoff"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    pickup_address: f.dropoff_address,
                    dropoff_address: f.pickup_address,
                  }))
                }
                className="inline-grid place-items-center"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                }}
              >
                <Icon name="swap" size={14} />
              </button>
            }
          >
            <Field label="Dropoff address">
              <AddressInput
                value={form.dropoff_address}
                onChange={(v) => update("dropoff_address", v)}
                placeholder="Search address or paste"
                suggestions={DROP_SUGGESTIONS}
              />
            </Field>
          </Section>

          {/* FLIGHT (collapsible) */}
          <section
            className="section-card"
            style={{ overflow: "hidden" }}
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => setFlightOpen((o) => !o)}
              aria-expanded={flightOpen}
            >
              <SectionHeader
                icon="plane"
                title="Flight"
                subtitle={
                  flightOpen
                    ? "Optional — fill if you want to track this flight."
                    : "Add airline + flight number — optional."
                }
                step={4}
                total={7}
                action={
                  <span
                    className="chev text-muted"
                    data-open={flightOpen}
                  >
                    <Icon name="chev" size={14} />
                  </span>
                }
              />
            </button>
            {flightOpen ? (
              <div className="p-4 md:p-5 flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Airline">
                    <input
                      className="field"
                      placeholder="e.g. Lufthansa"
                      value={form.flight_airline}
                      onChange={(e) =>
                        update("flight_airline", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Flight number">
                    <input
                      className="field tnum"
                      placeholder="e.g. UA 1184"
                      value={form.flight_number}
                      onChange={(e) =>
                        update("flight_number", e.target.value)
                      }
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Airport">
                    <select
                      className="field"
                      value={form.flight_airport}
                      onChange={(e) =>
                        update("flight_airport", e.target.value)
                      }
                    >
                      {AIRPORTS.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Terminal" optional>
                    <input
                      className="field tnum"
                      placeholder="e.g. TBIT, T7"
                      value={form.flight_terminal}
                      onChange={(e) =>
                        update("flight_terminal", e.target.value)
                      }
                    />
                  </Field>
                </div>
              </div>
            ) : null}
          </section>

          <Section
            icon="car"
            title="Assignment"
            subtitle="Who's driving and in what."
            step={5}
            total={7}
          >
            <Field label="Driver">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {drivers.map((d) => {
                  const on = form.driver_id === d.id;
                  return (
                    <button
                      type="button"
                      key={d.id}
                      onClick={() => update("driver_id", on ? "" : d.id)}
                      className="flex items-center gap-2.5 px-3 py-2.5 text-left transition"
                      style={{
                        borderRadius: 10,
                        background: on
                          ? "color-mix(in oklab, var(--accent) 10%, var(--surface))"
                          : "var(--surface-2)",
                        border: `1px solid ${
                          on ? "var(--accent)" : "var(--border)"
                        }`,
                      }}
                    >
                      <Avatar name={d.full_name} size={28} />
                      <div className="min-w-0">
                        <div
                          className="truncate"
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            letterSpacing: "-0.005em",
                          }}
                        >
                          {d.full_name.replace(/\s+\(.*\)$/, "")}
                        </div>
                        <div
                          className="text-muted"
                          style={{ fontSize: 11 }}
                        >
                          {on ? "Selected" : "Available"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Vehicle">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {vehicles.map((v) => {
                  const on = form.vehicle_id === v.id;
                  return (
                    <button
                      type="button"
                      key={v.id}
                      onClick={() => update("vehicle_id", on ? "" : v.id)}
                      className="flex items-center gap-3 px-3 py-3 text-left transition"
                      style={{
                        borderRadius: 10,
                        background: on
                          ? "color-mix(in oklab, var(--accent) 10%, var(--surface))"
                          : "var(--surface-2)",
                        border: `1px solid ${
                          on ? "var(--accent)" : "var(--border)"
                        }`,
                      }}
                    >
                      <span
                        className="inline-grid place-items-center"
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          color: "var(--accent)",
                        }}
                      >
                        <Icon name="car" size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate"
                          style={{ fontSize: 13.5, fontWeight: 600 }}
                        >
                          {v.display_name}
                        </div>
                        <div
                          className="text-muted tnum"
                          style={{ fontSize: 11.5 }}
                        >
                          {v.plate ? `Plate ${v.plate}` : "No plate set"}
                        </div>
                      </div>
                      {on ? (
                        <Icon name="check" size={14} className="text-accent" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </Field>
          </Section>

          <Section
            icon="wallet"
            title="Billing"
            subtitle="Rate, gratuity, parking, terms."
            step={6}
            total={7}
          >
            <div className="grid grid-cols-3 gap-3">
              <Field label="Rate">
                <Currency
                  value={form.fare}
                  onChange={(v) => update("fare", v)}
                />
              </Field>
              <Field label="Gratuity">
                <Currency
                  value={form.gratuity}
                  onChange={(v) => update("gratuity", v)}
                />
              </Field>
              <Field label="Parking">
                <Currency
                  value={form.parking}
                  onChange={(v) => update("parking", v)}
                />
              </Field>
            </div>
            <Field label="Terms">
              <div className="seg">
                {TERMS.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    aria-pressed={form.billing_terms === t.id}
                    onClick={() =>
                      update(
                        "billing_terms",
                        form.billing_terms === t.id ? "" : t.id,
                      )
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>
            <div
              className="flex items-center justify-between rounded-[10px] px-4 py-3"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              <div>
                <div
                  className="text-muted"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontWeight: 500,
                  }}
                >
                  Total
                </div>
                <div
                  className="tnum"
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                  }}
                >
                  ${fmtMoney(total)}
                </div>
              </div>
              <div
                className="text-right text-muted tnum"
                style={{ fontSize: 12 }}
              >
                <div>Rate ${fmtMoney(parseFloat(form.fare || "0") || 0)}</div>
                <div>
                  + Gratuity ${fmtMoney(parseFloat(form.gratuity || "0") || 0)}
                </div>
                <div>
                  + Parking ${fmtMoney(parseFloat(form.parking || "0") || 0)}
                </div>
              </div>
            </div>
          </Section>

          <Section
            icon="note"
            title="Notes"
            subtitle="Visible to the assigned driver."
            step={7}
            total={7}
          >
            <textarea
              className="field"
              placeholder={
                'e.g. "Two large suitcases. Carlos prefers no music. Use the side gate."'
              }
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={4}
            />
            <div className="help flex items-center justify-between">
              <span>Driver sees this in the dispatch packet.</span>
              <span className="tnum">{form.notes.length}/500</span>
            </div>
          </Section>

          {error ? (
            <div className="surface rounded-[12px] p-4 text-danger text-sm">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="sticky-bar">
        <div className="mx-auto max-w-[760px] px-4 md:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="hidden sm:flex flex-col min-w-0">
              <span
                className="text-muted"
                style={{ fontSize: 11.5 }}
              >
                {isValid
                  ? "Ready to save"
                  : "Add passenger name, pickup date, time + address to continue"}
              </span>
              <span
                className="tnum truncate"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                {form.pickup_date.replace(/-/g, "/")} · {form.pickup_time} · $
                {fmtMoney(total)}
              </span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-[8px] text-[14px] font-semibold transition"
                style={{
                  background: "transparent",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
                disabled={!isValid || saving}
                onClick={() => submit(false)}
              >
                <Icon name="save" size={15} /> Save only
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-[8px] text-[14px] font-semibold transition"
                style={{
                  background: "var(--accent)",
                  color: "#15161B",
                  border: "1px solid var(--accent-strong)",
                  opacity: isValid ? 1 : 0.55,
                  cursor: isValid ? "pointer" : "not-allowed",
                }}
                disabled={!isValid || saving}
                onClick={() => submit(true)}
              >
                <Icon name="doc" size={15} />
                {saving
                  ? "Saving…"
                  : editing
                  ? "Save & view"
                  : "Save & open packet"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Section primitives ─────────────────────────────────────────────── */

function Section({
  icon,
  title,
  subtitle,
  step,
  total,
  action,
  children,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  step?: number;
  total?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="section-card">
      <SectionHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        step={step}
        total={total}
        action={action}
      />
      <div className="p-4 md:p-5 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  step,
  total,
  action,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  step?: number;
  total?: number;
  action?: React.ReactNode;
}) {
  return (
    <header
      className="flex items-start gap-3 px-4 md:px-5 py-4"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <span
        className="inline-grid place-items-center shrink-0"
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--accent)",
        }}
      >
        <Icon name={icon} size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h2
            style={{
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h2>
          {step ? (
            <span className="text-muted tnum" style={{ fontSize: 11 }}>
              {step}/{total}
            </span>
          ) : null}
        </div>
        {subtitle ? (
          <p
            className="text-muted"
            style={{ fontSize: 12.5, marginTop: 2 }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {action}
    </header>
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

function Currency({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <span
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted tnum"
        style={{ fontSize: 14, pointerEvents: "none" }}
      >
        $
      </span>
      <input
        type="text"
        inputMode="decimal"
        className="field tnum"
        style={{ paddingLeft: 28 }}
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
      />
    </div>
  );
}

function ClientPicker({
  value,
  onChange,
  onPick,
  clients,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (c: Client) => void;
  clients: Client[];
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q),
    );
  }, [clients, value]);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          style={{ pointerEvents: "none" }}
        >
          <Icon name="user" size={15} />
        </span>
        <input
          className="field field-prefixed"
          placeholder="Type a name — or pick a recurring client"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-grid place-items-center"
          style={{ width: 28, height: 28, borderRadius: 6, color: "var(--text-muted)" }}
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle clients"
        >
          <Icon name="chevd" size={14} />
        </button>
      </div>
      {open ? (
        <div className="menu mt-2 left-0 right-0" style={{ top: "100%" }}>
          <div
            className="px-3 py-2 text-muted"
            style={{
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 500,
              borderBottom: "1px solid var(--border)",
            }}
          >
            Recurring clients · {filtered.length}
          </div>
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div
                className="px-3 py-4 text-muted"
                style={{ fontSize: 13 }}
              >
                No matches. We'll create{" "}
                <span style={{ color: "var(--text)", fontWeight: 500 }}>
                  "{value}"
                </span>{" "}
                as a one-off passenger.
              </div>
            ) : (
              filtered.map((c) => (
                <div
                  key={c.id}
                  className="menu-item"
                  data-on={value === c.name}
                  onClick={() => {
                    onPick(c);
                    setOpen(false);
                  }}
                >
                  <Avatar name={c.name} size={28} />
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                      {c.name}
                    </div>
                    <div
                      className="text-muted tnum truncate"
                      style={{ fontSize: 11.5 }}
                    >
                      {c.phone ?? "—"}
                      {c.company ? ` · ${c.company}` : ""}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AddressInput({
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  return (
    <div>
      <div className="relative">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          style={{ pointerEvents: "none" }}
        >
          <Icon name="pin" size={15} />
        </span>
        <input
          className="field field-prefixed"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {suggestions && suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggestions.map((s) => (
            <button
              type="button"
              key={s}
              className="chip"
              onClick={() => onChange(s)}
              style={{
                cursor: "pointer",
                background: "var(--surface-2)",
                color: "var(--text)",
                fontSize: 11.5,
              }}
            >
              <Icon name="pin" size={11} /> {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function rideToForm(r: Ride): FormState {
  const local = new Date(r.pickup_at);
  const offsetMs = local.getTimezoneOffset() * 60_000;
  const localISO = new Date(local.getTime() - offsetMs)
    .toISOString();
  return {
    passenger_name: r.passenger_name,
    passenger_phone: r.passenger_phone ?? "",
    client_id: r.client_id ?? "",
    pickup_date: localISO.slice(0, 10),
    pickup_time: localISO.slice(11, 16),
    pickup_address: r.pickup_address,
    dropoff_address: r.dropoff_address ?? "",
    flight_airline: r.flight_airline ?? "",
    flight_number: r.flight_number ?? "",
    flight_airport: r.flight_airport ?? "LAX",
    flight_terminal: r.flight_terminal ?? "",
    driver_id: r.driver_id ?? "",
    vehicle_id: r.vehicle_id ?? "",
    fare: r.fare_cents ? (r.fare_cents / 100).toFixed(2) : "",
    gratuity: r.gratuity_cents ? (r.gratuity_cents / 100).toFixed(2) : "",
    parking: r.parking_cents ? (r.parking_cents / 100).toFixed(2) : "",
    billing_terms: r.billing_terms ?? "",
    status: r.status,
    notes: r.notes ?? "",
  };
}
