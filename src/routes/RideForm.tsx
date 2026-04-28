import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getRide,
  listClients,
  listDrivers,
  listVehicles,
  upsertRide,
  deleteRide,
} from "../lib/api";
import { dollarsToCents } from "../lib/format";
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
  pickup_at: string; // datetime-local
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

const EMPTY: FormState = {
  passenger_name: "",
  passenger_phone: "",
  client_id: "",
  pickup_at: "",
  pickup_address: "",
  dropoff_address: "",
  flight_airline: "",
  flight_number: "",
  flight_airport: "",
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

  useEffect(() => {
    Promise.all([listClients(), listDrivers(), listVehicles()]).then(
      ([c, d, v]) => {
        setClients(c);
        setDrivers(d);
        setVehicles(v);
      },
    );
    if (editing && id) {
      getRide(id)
        .then((r) => {
          if (r) setForm(rideToForm(r));
        })
        .finally(() => setLoading(false));
    }
  }, [editing, id]);

  const set =
    <K extends keyof FormState>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<Ride> = {
        ...(editing && id ? { id } : {}),
        passenger_name: form.passenger_name.trim(),
        passenger_phone: form.passenger_phone.trim() || null,
        client_id: form.client_id || null,
        pickup_at: new Date(form.pickup_at).toISOString(),
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
      navigate(`/rides/${saved.id}`);
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

  return (
    <form onSubmit={submit} className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">
          {editing ? "Edit ride" : "New ride"}
        </h1>
        {editing ? (
          <button
            type="button"
            onClick={onDelete}
            className="btn btn-danger text-xs"
          >
            Delete
          </button>
        ) : null}
      </div>

      <Section title="Passenger">
        <Field label="Name" required>
          <input
            className="input"
            value={form.passenger_name}
            onChange={set("passenger_name")}
            required
          />
        </Field>
        <Field label="Phone (optional)">
          <input
            className="input"
            value={form.passenger_phone}
            onChange={set("passenger_phone")}
          />
        </Field>
        <Field label="Recurring client (optional)">
          <select
            className="input"
            value={form.client_id}
            onChange={set("client_id")}
          >
            <option value="">— None —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.company ? ` (${c.company})` : ""}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Pickup">
        <Field label="Date & time" required>
          <input
            type="datetime-local"
            className="input"
            value={form.pickup_at}
            onChange={set("pickup_at")}
            required
          />
        </Field>
        <Field label="Pickup address" required>
          <input
            className="input"
            value={form.pickup_address}
            onChange={set("pickup_address")}
            required
          />
        </Field>
        <Field label="Drop-off address">
          <input
            className="input"
            value={form.dropoff_address}
            onChange={set("dropoff_address")}
          />
        </Field>
      </Section>

      <Section title="Flight (optional)">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Airline">
            <input
              className="input"
              value={form.flight_airline}
              onChange={set("flight_airline")}
            />
          </Field>
          <Field label="Flight #">
            <input
              className="input"
              value={form.flight_number}
              onChange={set("flight_number")}
            />
          </Field>
          <Field label="Airport">
            <input
              className="input"
              placeholder="LAX"
              value={form.flight_airport}
              onChange={set("flight_airport")}
            />
          </Field>
          <Field label="Terminal">
            <input
              className="input"
              value={form.flight_terminal}
              onChange={set("flight_terminal")}
            />
          </Field>
        </div>
      </Section>

      <Section title="Assignment">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Driver">
            <select
              className="input"
              value={form.driver_id}
              onChange={set("driver_id")}
            >
              <option value="">— Unassigned —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vehicle">
            <select
              className="input"
              value={form.vehicle_id}
              onChange={set("vehicle_id")}
            >
              <option value="">— Unassigned —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.display_name}
                  {v.plate ? ` (${v.plate})` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Status">
          <select
            className="input"
            value={form.status}
            onChange={set("status")}
          >
            <option value="scheduled">Scheduled</option>
            <option value="requested">Requested</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
      </Section>

      <Section title="Billing">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Fare ($)">
            <input
              className="input tabular"
              inputMode="decimal"
              value={form.fare}
              onChange={set("fare")}
            />
          </Field>
          <Field label="Gratuity ($)">
            <input
              className="input tabular"
              inputMode="decimal"
              value={form.gratuity}
              onChange={set("gratuity")}
            />
          </Field>
          <Field label="Parking ($)">
            <input
              className="input tabular"
              inputMode="decimal"
              value={form.parking}
              onChange={set("parking")}
            />
          </Field>
        </div>
        <Field label="Terms">
          <select
            className="input"
            value={form.billing_terms}
            onChange={set("billing_terms")}
          >
            <option value="">— None —</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="zelle">Zelle</option>
            <option value="net_15">Net 15</option>
            <option value="net_30">Net 30</option>
            <option value="company_billing">Company billing</option>
          </select>
        </Field>
      </Section>

      <Section title="Notes">
        <textarea
          className="input min-h-[88px]"
          value={form.notes}
          onChange={set("notes")}
          placeholder="Special instructions, luggage, preferences…"
        />
      </Section>

      {error ? <div className="card text-danger text-sm">{error}</div> : null}

      <div className="fixed bottom-0 inset-x-0 bg-bg/90 backdrop-blur border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-3 flex gap-2 justify-end">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Save ride"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card space-y-3">
      <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm space-y-1">
      <span className="text-muted">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

function rideToForm(r: Ride): FormState {
  // Convert ISO to a value the datetime-local input accepts.
  const local = new Date(r.pickup_at);
  const offsetMs = local.getTimezoneOffset() * 60_000;
  const datetimeLocal = new Date(local.getTime() - offsetMs)
    .toISOString()
    .slice(0, 16);

  return {
    passenger_name: r.passenger_name,
    passenger_phone: r.passenger_phone ?? "",
    client_id: r.client_id ?? "",
    pickup_at: datetimeLocal,
    pickup_address: r.pickup_address,
    dropoff_address: r.dropoff_address ?? "",
    flight_airline: r.flight_airline ?? "",
    flight_number: r.flight_number ?? "",
    flight_airport: r.flight_airport ?? "",
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
