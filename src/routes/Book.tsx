// Public booking page (no auth required). 4-step inline form.
//
// Trip type → When/where → Contact → Review → submit.
// On submit, calls the submit_booking_request RPC which inserts a ride
// with status='requested' and source='booking_form'. Owner sees it on the
// dashboard activity feed and Today/upcoming.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { submitBookingRequest } from "../lib/api";
import { Icon } from "../components/Icon";

type TripType = "one_way" | "round_trip" | "hourly" | "airport";
const TRIP_TYPES: { id: TripType; label: string; hint: string }[] = [
  { id: "airport", label: "Airport transfer", hint: "Pickup or drop-off · LAX, VNY, BUR, LGB" },
  { id: "one_way", label: "One way", hint: "Single A → B trip" },
  { id: "round_trip", label: "Round trip", hint: "Same vehicle waits + returns" },
  { id: "hourly", label: "Hourly · as directed", hint: "Multi-stop, you keep the car" },
];

type Step = 0 | 1 | 2 | 3;
const STEP_LABELS = ["Trip type", "When & where", "Contact", "Review"];

export function Book() {
  const [step, setStep] = useState<Step>(0);
  const [tripType, setTripType] = useState<TripType>("airport");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("09:00");
  const [pickupAddr, setPickupAddr] = useState("");
  const [dropoffAddr, setDropoffAddr] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const can = useMemo(
    () => ({
      0: !!tripType,
      1:
        !!pickupDate &&
        !!pickupTime &&
        pickupAddr.trim().length > 0 &&
        (tripType === "hourly" || dropoffAddr.trim().length > 0),
      2: name.trim().length > 0 && email.trim().includes("@"),
      3: true,
    }),
    [tripType, pickupDate, pickupTime, pickupAddr, dropoffAddr, name, email],
  );

  const next = () => setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  const back = () => setStep((s) => (s > 0 ? ((s - 1) as Step) : s));

  const submit = async () => {
    if (!can[2]) return;
    setSubmitting(true);
    setError(null);
    try {
      const iso = new Date(`${pickupDate}T${pickupTime}`).toISOString();
      const id = await submitBookingRequest({
        passenger_name: name.trim(),
        passenger_phone: phone.trim() || undefined,
        passenger_email: email.trim() || undefined,
        pickup_at: iso,
        pickup_address: pickupAddr.trim(),
        dropoff_address: dropoffAddr.trim() || undefined,
        trip_type: TRIP_TYPES.find((t) => t.id === tripType)?.label,
        notes: notes.trim() || undefined,
      });
      setSubmitted(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <Confirmation referenceId={submitted} firstName={firstName(name)} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNav />

      {/* Hero */}
      <header className="px-5 md:px-8 pt-10 md:pt-16 pb-8 max-w-[920px] mx-auto w-full">
        <p className="eyebrow mb-3">SDLuxury Transportation · Los Angeles</p>
        <h1
          className="serif"
          style={{
            fontSize: "clamp(36px, 6vw, 56px)",
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
          }}
        >
          Book a private chauffeur in{" "}
          <span style={{ fontStyle: "italic", color: "var(--accent)" }}>
            Los Angeles
          </span>
          .
        </h1>
        <p
          className="text-muted mt-4"
          style={{ fontSize: 15, lineHeight: 1.6, maxWidth: 540 }}
        >
          Late-model black SUVs, professional chauffeurs, and quiet,
          on-time service for airport transfers, corporate work, and
          evenings out. Sergio will reach out within the hour to confirm.
        </p>
      </header>

      {/* Form */}
      <main className="flex-1 px-5 md:px-8 pb-16 max-w-[920px] mx-auto w-full">
        <Stepper step={step} />

        {error ? (
          <div className="mt-6 surface rounded-[12px] p-4 text-danger text-sm">
            {error}
          </div>
        ) : null}

        <div className="mt-8 surface rounded-[12px] p-5 md:p-7">
          {step === 0 ? (
            <StepTripType value={tripType} onChange={setTripType} />
          ) : null}
          {step === 1 ? (
            <StepWhenWhere
              tripType={tripType}
              pickupDate={pickupDate}
              pickupTime={pickupTime}
              pickupAddr={pickupAddr}
              dropoffAddr={dropoffAddr}
              onChange={(p) => {
                if (p.pickupDate !== undefined) setPickupDate(p.pickupDate);
                if (p.pickupTime !== undefined) setPickupTime(p.pickupTime);
                if (p.pickupAddr !== undefined) setPickupAddr(p.pickupAddr);
                if (p.dropoffAddr !== undefined) setDropoffAddr(p.dropoffAddr);
              }}
            />
          ) : null}
          {step === 2 ? (
            <StepContact
              name={name}
              email={email}
              phone={phone}
              notes={notes}
              onChange={(p) => {
                if (p.name !== undefined) setName(p.name);
                if (p.email !== undefined) setEmail(p.email);
                if (p.phone !== undefined) setPhone(p.phone);
                if (p.notes !== undefined) setNotes(p.notes);
              }}
            />
          ) : null}
          {step === 3 ? (
            <StepReview
              tripType={TRIP_TYPES.find((t) => t.id === tripType)!.label}
              pickupDate={pickupDate}
              pickupTime={pickupTime}
              pickupAddr={pickupAddr}
              dropoffAddr={dropoffAddr}
              name={name}
              email={email}
              phone={phone}
              notes={notes}
              onEdit={(s) => setStep(s as Step)}
            />
          ) : null}
        </div>

        {/* Nav */}
        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            onClick={back}
            disabled={step === 0}
            className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-[8px] text-[14px] font-medium disabled:opacity-40"
            style={{
              background: "transparent",
              color: "var(--text)",
              border: "1px solid var(--border)",
            }}
          >
            <Icon name="back" size={14} /> Back
          </button>
          {step < 3 ? (
            <button
              onClick={next}
              disabled={!can[step]}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-[8px] text-[14px] font-semibold disabled:opacity-50"
              style={{
                background: "var(--accent)",
                color: "#15161B",
                border: "1px solid var(--accent-strong)",
              }}
            >
              Continue <Icon name="arrow" size={14} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!can[2] || submitting}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-[8px] text-[14px] font-semibold disabled:opacity-50"
              style={{
                background: "var(--accent)",
                color: "#15161B",
                border: "1px solid var(--accent-strong)",
              }}
            >
              {submitting ? "Sending…" : "Send request"}
              {!submitting ? <Icon name="check" size={14} /> : null}
            </button>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

/* ── Stepper ───────────────────────────────────────────────────── */
function Stepper({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-2 whitespace-nowrap">
          <span
            className="inline-grid place-items-center tabular"
            style={{
              width: 24,
              height: 24,
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              background:
                i < step
                  ? "var(--success)"
                  : i === step
                  ? "var(--accent)"
                  : "var(--surface-2)",
              color:
                i <= step ? "#15161B" : "var(--text-muted)",
              border:
                i <= step
                  ? "none"
                  : "1px solid var(--border)",
            }}
          >
            {i < step ? <Icon name="check" size={12} /> : i + 1}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: i === step ? 600 : 500,
              color: i === step ? "var(--text)" : "var(--text-muted)",
            }}
          >
            {label}
          </span>
          {i < STEP_LABELS.length - 1 ? (
            <span
              className="hidden sm:inline-block"
              style={{
                width: 24,
                height: 1,
                background: "var(--border)",
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ── Step 1: Trip type ─────────────────────────────────────────── */
function StepTripType({
  value,
  onChange,
}: {
  value: TripType;
  onChange: (v: TripType) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="serif" style={{ fontSize: 24, letterSpacing: "-0.01em" }}>
        What kind of ride?
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {TRIP_TYPES.map((t) => {
          const active = value === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className="text-left rounded-[10px] px-4 py-3 transition"
              style={{
                background: active
                  ? "color-mix(in oklab, var(--accent) 10%, var(--surface))"
                  : "var(--surface-2)",
                border: `1px solid ${
                  active ? "var(--accent)" : "var(--border)"
                }`,
              }}
            >
              <div className="flex items-center gap-2">
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t.label}</div>
                {active ? (
                  <Icon name="check" size={14} className="text-accent" />
                ) : null}
              </div>
              <div
                className="text-muted mt-0.5"
                style={{ fontSize: 12.5 }}
              >
                {t.hint}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Step 2: When & where ─────────────────────────────────────── */
function StepWhenWhere({
  tripType,
  pickupDate,
  pickupTime,
  pickupAddr,
  dropoffAddr,
  onChange,
}: {
  tripType: TripType;
  pickupDate: string;
  pickupTime: string;
  pickupAddr: string;
  dropoffAddr: string;
  onChange: (
    p: Partial<{
      pickupDate: string;
      pickupTime: string;
      pickupAddr: string;
      dropoffAddr: string;
    }>,
  ) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="serif" style={{ fontSize: 24, letterSpacing: "-0.01em" }}>
        When &amp; where
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date">
          <input
            type="date"
            className="field tnum"
            value={pickupDate}
            onChange={(e) => onChange({ pickupDate: e.target.value })}
            required
          />
        </Field>
        <Field label="Time">
          <input
            type="time"
            className="field tnum"
            value={pickupTime}
            onChange={(e) => onChange({ pickupTime: e.target.value })}
            required
          />
        </Field>
      </div>
      <Field label="Pickup address">
        <input
          className="field"
          placeholder="e.g. 9876 Wilshire Blvd, Beverly Hills"
          value={pickupAddr}
          onChange={(e) => onChange({ pickupAddr: e.target.value })}
          required
        />
      </Field>
      {tripType !== "hourly" ? (
        <Field label="Dropoff address">
          <input
            className="field"
            placeholder="e.g. LAX · Tom Bradley Intl Terminal"
            value={dropoffAddr}
            onChange={(e) => onChange({ dropoffAddr: e.target.value })}
            required
          />
        </Field>
      ) : (
        <div
          className="rounded-[8px] px-3 py-2.5 text-[12.5px]"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
        >
          Hourly: skip dropoff. Tell us your itinerary in step 3 (notes).
        </div>
      )}
    </div>
  );
}

/* ── Step 3: Contact ─────────────────────────────────────────── */
function StepContact({
  name,
  email,
  phone,
  notes,
  onChange,
}: {
  name: string;
  email: string;
  phone: string;
  notes: string;
  onChange: (
    p: Partial<{
      name: string;
      email: string;
      phone: string;
      notes: string;
    }>,
  ) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="serif" style={{ fontSize: 24, letterSpacing: "-0.01em" }}>
        Where do we reach you?
      </h2>
      <Field label="Full name">
        <input
          className="field"
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          required
          autoFocus
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email">
          <input
            type="email"
            className="field"
            value={email}
            onChange={(e) => onChange({ email: e.target.value })}
            required
          />
        </Field>
        <Field label="Phone" optional>
          <input
            className="field tnum"
            placeholder="+1 (___) ___-____"
            value={phone}
            onChange={(e) => onChange({ phone: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Anything we should know?" optional>
        <textarea
          className="field"
          rows={3}
          placeholder="Flight #, special requests, child seats, etc."
          value={notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </Field>
    </div>
  );
}

/* ── Step 4: Review ──────────────────────────────────────────── */
function StepReview(props: {
  tripType: string;
  pickupDate: string;
  pickupTime: string;
  pickupAddr: string;
  dropoffAddr: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  onEdit: (step: number) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="serif" style={{ fontSize: 24, letterSpacing: "-0.01em" }}>
        Review
      </h2>
      <ReviewRow
        label="Trip type"
        value={props.tripType}
        onEdit={() => props.onEdit(0)}
      />
      <ReviewRow
        label="When"
        value={
          props.pickupDate && props.pickupTime
            ? `${props.pickupDate.replace(/-/g, "/")} · ${props.pickupTime}`
            : "—"
        }
        onEdit={() => props.onEdit(1)}
      />
      <ReviewRow
        label="Pickup"
        value={props.pickupAddr}
        onEdit={() => props.onEdit(1)}
      />
      {props.dropoffAddr ? (
        <ReviewRow
          label="Dropoff"
          value={props.dropoffAddr}
          onEdit={() => props.onEdit(1)}
        />
      ) : null}
      <ReviewRow
        label="Contact"
        value={
          <span>
            {props.name}
            {props.email ? <span className="text-muted"> · {props.email}</span> : null}
            {props.phone ? <span className="text-muted"> · {props.phone}</span> : null}
          </span>
        }
        onEdit={() => props.onEdit(2)}
      />
      {props.notes ? (
        <ReviewRow
          label="Notes"
          value={<span style={{ whiteSpace: "pre-wrap" }}>{props.notes}</span>}
          onEdit={() => props.onEdit(2)}
        />
      ) : null}
    </div>
  );
}

function ReviewRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <div
      className="flex items-start gap-3 py-3"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div
        className="text-muted shrink-0"
        style={{
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontWeight: 500,
          width: 80,
        }}
      >
        {label}
      </div>
      <div className="flex-1 min-w-0" style={{ fontSize: 14 }}>
        {value}
      </div>
      <button
        onClick={onEdit}
        className="text-accent shrink-0"
        style={{ fontSize: 12.5, fontWeight: 500 }}
      >
        Edit
      </button>
    </div>
  );
}

/* ── Confirmation ─────────────────────────────────────────────── */
function Confirmation({
  referenceId,
  firstName,
}: {
  referenceId: string;
  firstName: string;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicNav />
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-[520px] text-center space-y-5">
          <div
            className="mx-auto inline-grid place-items-center"
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              background:
                "color-mix(in oklab, var(--success) 22%, var(--surface))",
              color: "var(--success)",
              border:
                "1px solid color-mix(in oklab, var(--success) 50%, var(--border))",
            }}
          >
            <Icon name="check" size={28} />
          </div>
          <h1
            className="serif"
            style={{ fontSize: 36, letterSpacing: "-0.015em", lineHeight: 1.1 }}
          >
            Thank you{firstName ? `, ${firstName}` : ""}.
          </h1>
          <p
            className="text-muted"
            style={{ fontSize: 15, lineHeight: 1.6 }}
          >
            Your request is in our system. Sergio from SDLuxury will reach
            out within the hour to confirm details.
          </p>
          <div
            className="mx-auto inline-block tabular text-muted"
            style={{
              fontSize: 12,
              padding: "6px 12px",
              borderRadius: 999,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            Reference · {referenceId.slice(0, 8).toUpperCase()}
          </div>
          <div className="pt-4">
            <Link
              to="/book"
              className="inline-flex items-center gap-1.5 text-accent"
              style={{ fontSize: 13, fontWeight: 500 }}
              onClick={() => window.location.reload()}
            >
              Book another ride <Icon name="arrow" size={12} />
            </Link>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

/* ── Public chrome ─────────────────────────────────────────────── */
function PublicNav() {
  return (
    <header
      className="sticky top-0 z-20"
      style={{
        background: "color-mix(in oklab, var(--bg) 80%, transparent)",
        borderBottom: "1px solid var(--border)",
        backdropFilter: "blur(14px)",
      }}
    >
      <div className="mx-auto max-w-[1200px] px-5 md:px-8 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <div
            aria-hidden
            className="grid place-items-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              fontWeight: 700,
              fontSize: 13,
              color: "var(--accent)",
            }}
          >
            SD
          </div>
          <span
            className="serif"
            style={{ fontSize: 20, letterSpacing: "-0.01em" }}
          >
            SDLuxury
          </span>
        </a>
        <a
          href="/"
          className="text-muted hover:text-text"
          style={{ fontSize: 13, letterSpacing: "0.04em" }}
        >
          Sign in
        </a>
      </div>
    </header>
  );
}

function PublicFooter() {
  return (
    <footer
      className="text-muted text-center py-6"
      style={{ fontSize: 11.5, borderTop: "1px solid var(--border)" }}
    >
      SDLuxury Transportation, Inc. · Los Angeles
    </footer>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
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
    </div>
  );
}

function firstName(s: string): string {
  return s.split(/\s+/)[0].replace(/[(),]/g, "");
}
