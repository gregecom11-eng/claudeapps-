// Public marketing landing page (no auth required).
//
// Structure modeled after Blacklane's homepage:
//   1. Hero with embedded slim booking widget (trip type tabs + pickup
//      + date/time → deep-link to /book with all values pre-filled).
//   2. Trust strip (single row of icon + one-liner).
//   3. Why-us pillars (4 cards, no photos — pure typography).
//   4. What-you-can-book (4 trip-type cards).
//   5. How it works (3 steps).
//   6. App promo (install / "add to home screen").
//   7. Final CTA over the interior photo.
//   8. Footer.
//
// Brand palette stays champagne-on-black (Path A) — only the LAYOUT
// is borrowed from Blacklane. Identity is preserved.

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { brand } from "../brand";

type TripType = "airport" | "one_way" | "round_trip" | "hourly";

const TRIP_TABS: { id: TripType; label: string }[] = [
  { id: "airport", label: "Airport" },
  { id: "one_way", label: "One way" },
  { id: "hourly", label: "Hourly" },
  { id: "round_trip", label: "Round trip" },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <LandingNav />
      <Hero />
      <TrustStrip />
      <WhyUs />
      <Services />
      <HowItWorks />
      <AppPromo />
      <FinalCta />
      <Footer />
    </div>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────
function LandingNav() {
  return (
    <nav className="sticky top-0 z-30 backdrop-blur-md bg-bg/80 border-b border-border">
      <div className="max-w-[1200px] mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src={brand.assets.appIcon}
            alt=""
            className="w-9 h-9 rounded-md transition-transform group-hover:scale-105"
          />
          <span className="serif text-[22px] leading-none tracking-[-0.01em]">
            {brand.shortName}
          </span>
        </Link>
        <div className="flex items-center gap-2 md:gap-4">
          <a
            href={brand.phoneHref}
            className="hidden sm:inline text-[13px] text-muted hover:text-accent transition-colors tracking-wide"
          >
            {brand.phone}
          </a>
          <Link
            to="/login"
            className="inline-flex items-center justify-center h-9 px-3 text-[13px] text-muted hover:text-text transition-colors tracking-wide"
          >
            Sign in
          </Link>
          <Link
            to="/book"
            className="inline-flex items-center justify-center h-10 px-5 rounded-[8px] bg-accent text-[#0A0A0D] text-[13px] font-semibold tracking-wide hover:bg-accent-strong active:scale-[0.98] transition-[transform,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Book a ride
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ── Hero with booking widget ──────────────────────────────────────────
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <picture>
        <source media="(min-width: 768px)" srcSet={brand.assets.heroDesktop} />
        <img
          src={brand.assets.heroMobile}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      </picture>
      {/* Dark gradient for legibility */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,10,13,0.55) 0%, rgba(10,10,13,0.80) 60%, rgba(10,10,13,0.95) 100%)",
        }}
        aria-hidden
      />
      {/* Warm champagne wash */}
      <div
        className="absolute inset-0 mix-blend-multiply"
        style={{
          background:
            "radial-gradient(60% 80% at 30% 40%, rgba(200,169,126,0.18), transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative max-w-[1200px] mx-auto px-5 md:px-8 pt-20 md:pt-28 pb-12 md:pb-32">
        <p className="eyebrow text-accent/90 mb-5">{brand.hero.eyebrow}</p>
        <h1
          className="serif text-[40px] sm:text-[56px] md:text-[80px] leading-[0.95] tracking-[-0.03em] max-w-[16ch]"
          style={{ textShadow: "0 2px 24px rgba(0,0,0,0.45)" }}
        >
          {brand.hero.headline.split("\n").map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </h1>
        <p className="mt-5 max-w-[52ch] text-[15px] md:text-[17px] leading-[1.7] text-text/85">
          {brand.hero.sub}
        </p>

        <BookingWidget />

        <p className="mt-5 text-[12px] tracking-[0.18em] uppercase text-text/55">
          Or call <a className="text-accent hover:text-accent-strong transition-colors" href={brand.phoneHref}>{brand.phone}</a>
        </p>
      </div>
    </section>
  );
}

// ── Slim 3-field booking widget ───────────────────────────────────────
function BookingWidget() {
  const navigate = useNavigate();
  const [tripType, setTripType] = useState<TripType>("airport");
  const [pickup, setPickup] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("trip_type", tripType);
    if (pickup) params.set("pickup", pickup);
    if (date) params.set("pickup_at", `${date}T${time}`);
    navigate(`/book?${params.toString()}`);
  };

  return (
    <form
      onSubmit={submit}
      className="mt-9 surface-elev rounded-[16px] p-2 md:p-3 max-w-[860px]"
      style={{
        boxShadow:
          "0 1px 2px rgba(0,0,0,0.25), 0 28px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(200,169,126,0.08)",
        background:
          "linear-gradient(180deg, rgba(20,20,27,0.92), rgba(14,14,19,0.92))",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Trip type tabs */}
      <div
        role="tablist"
        aria-label="Trip type"
        className="flex flex-wrap gap-1 p-1 mb-2 md:mb-3 rounded-[10px] bg-bg/60"
      >
        {TRIP_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tripType === t.id}
            onClick={() => setTripType(t.id)}
            className={`flex-1 min-w-[88px] h-9 px-3 rounded-[8px] text-[13px] font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              tripType === t.id
                ? "bg-accent text-[#0A0A0D]"
                : "text-text/75 hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_0.7fr_0.6fr_auto] gap-2 p-2 md:p-0">
        <FieldShell label="Pickup">
          <input
            type="text"
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
            placeholder="Address, airport, or hotel"
            className="w-full h-11 bg-transparent text-[15px] text-text placeholder:text-text/35 focus:outline-none"
          />
        </FieldShell>
        <FieldShell label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-11 bg-transparent text-[15px] text-text placeholder:text-text/35 focus:outline-none [color-scheme:dark]"
          />
        </FieldShell>
        <FieldShell label="Time">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full h-11 bg-transparent text-[15px] text-text placeholder:text-text/35 focus:outline-none [color-scheme:dark]"
          />
        </FieldShell>
        <button
          type="submit"
          className="h-12 md:h-auto min-h-[48px] px-6 md:px-7 rounded-[10px] bg-accent text-[#0A0A0D] text-[14px] font-semibold tracking-wide hover:bg-accent-strong active:scale-[0.98] transition-[transform,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent inline-flex items-center justify-center gap-2"
        >
          See options
          <ArrowRight />
        </button>
      </div>
    </form>
  );
}

function FieldShell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block rounded-[10px] bg-bg/60 border border-border/70 px-4 py-2.5 cursor-text hover:border-accent/40 focus-within:border-accent transition-colors">
      <span className="block text-[10.5px] tracking-[0.18em] uppercase text-text/55 mb-0.5">
        {label}
      </span>
      {children}
    </label>
  );
}

// ── Trust strip ───────────────────────────────────────────────────────
function TrustStrip() {
  const items: { icon: React.ReactNode; text: string }[] = [
    { icon: <IconShield />, text: "Vetted chauffeurs" },
    { icon: <IconPlane />, text: "Flight tracking" },
    { icon: <IconTag />, text: "Fixed price" },
    { icon: <IconClock />, text: "24/7 dispatch" },
  ];
  return (
    <section className="border-y border-border bg-surface/40">
      <div className="max-w-[1200px] mx-auto px-5 md:px-8 py-6 md:py-7 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4">
        {items.map((it) => (
          <div key={it.text} className="flex items-center gap-3">
            <span className="text-accent shrink-0">{it.icon}</span>
            <span className="text-[13px] md:text-[14px] tracking-wide text-text/85">
              {it.text}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Why us (4 pillars, no photos) ─────────────────────────────────────
function WhyUs() {
  const icons = [<IconShieldCheck />, <IconStopwatch />, <IconReceipt />, <IconPhone />];
  return (
    <section className="py-20 md:py-32">
      <div className="max-w-[1200px] mx-auto px-5 md:px-8">
        <p className="eyebrow text-accent mb-4">Why us</p>
        <h2 className="serif text-[34px] md:text-[52px] leading-[1.05] tracking-[-0.02em] max-w-[18ch]">
          Built for the trips that matter.
        </h2>
        <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          {brand.pillars.map((p, i) => (
            <article
              key={p.title}
              className="surface rounded-[14px] p-6 md:p-7 hover:border-accent/60 transition-colors"
            >
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-[10px] text-accent mb-5"
                style={{ background: "var(--accent-soft)" }}
              >
                {icons[i]}
              </div>
              <h3 className="serif text-[22px] md:text-[24px] tracking-[-0.01em]">
                {p.title}
              </h3>
              <p className="mt-3 text-[14px] leading-[1.7] text-muted">
                {p.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Services (what you can book) ──────────────────────────────────────
function Services() {
  return (
    <section className="py-20 md:py-32 border-t border-border bg-surface/40">
      <div className="max-w-[1200px] mx-auto px-5 md:px-8">
        <p className="eyebrow text-accent mb-4">What you can book</p>
        <h2 className="serif text-[34px] md:text-[52px] leading-[1.05] tracking-[-0.02em] max-w-[18ch]">
          Four kinds of trips. One standard.
        </h2>
        <p className="mt-4 max-w-[58ch] text-[15px] md:text-[16px] leading-[1.7] text-muted">
          Black SUV or executive sedan, full-time chauffeur, dispatcher
          confirmation. No surge pricing, no rideshare pool.
        </p>

        <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          {brand.services.map((svc, i) => (
            <article
              key={svc.id}
              className="group surface rounded-[14px] p-6 md:p-8 hover:border-accent/60 transition-colors relative overflow-hidden"
            >
              {i === 0 && <ServicePhoto src={brand.assets.serviceAirport} />}
              {i === 2 && <ServicePhoto src={brand.assets.serviceInterior} />}
              <div className="relative">
                <h3 className="serif text-[24px] md:text-[28px] tracking-[-0.01em]">
                  {svc.title}
                </h3>
                <p className="mt-3 text-[14px] md:text-[15px] leading-[1.7] text-muted max-w-[44ch]">
                  {svc.description}
                </p>
                <Link
                  to={`/book?trip_type=${svc.tripType}`}
                  className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent-strong tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                >
                  Book this trip <ArrowRight />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ServicePhoto({ src }: { src: string }) {
  return (
    <div className="absolute -right-8 -top-8 w-[160px] h-[160px] md:w-[200px] md:h-[200px] rounded-full overflow-hidden opacity-40 group-hover:opacity-60 transition-opacity">
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover"
        style={{ mixBlendMode: "screen" }}
      />
    </div>
  );
}

// ── How it works ──────────────────────────────────────────────────────
function HowItWorks() {
  return (
    <section id="how" className="py-20 md:py-32">
      <div className="max-w-[1200px] mx-auto px-5 md:px-8">
        <p className="eyebrow text-accent mb-4">How it works</p>
        <h2 className="serif text-[34px] md:text-[52px] leading-[1.05] tracking-[-0.02em] max-w-[18ch]">
          Three steps, then we take it from there.
        </h2>

        <ol className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {brand.steps.map((step) => (
            <li key={step.n} className="surface-2 rounded-[14px] p-6 md:p-8">
              <div className="display-num text-[44px] md:text-[56px] text-accent leading-none">
                0{step.n}
              </div>
              <h3 className="mt-5 serif text-[22px] md:text-[26px] tracking-[-0.01em]">
                {step.title}
              </h3>
              <p className="mt-3 text-[14px] md:text-[15px] leading-[1.7] text-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ── App promo ─────────────────────────────────────────────────────────
function AppPromo() {
  return (
    <section className="py-20 md:py-32 border-t border-border bg-surface/40">
      <div className="max-w-[1200px] mx-auto px-5 md:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
        <div>
          <p className="eyebrow text-accent mb-4">{brand.appPromo.eyebrow}</p>
          <h2 className="serif text-[34px] md:text-[52px] leading-[1.05] tracking-[-0.02em] max-w-[16ch]">
            {brand.appPromo.headline}
          </h2>
          <p className="mt-5 max-w-[44ch] text-[15px] md:text-[16px] leading-[1.7] text-muted">
            {brand.appPromo.body}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/install"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-[10px] bg-accent text-[#0A0A0D] text-[14px] font-semibold tracking-wide hover:bg-accent-strong active:scale-[0.98] transition-[transform,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {brand.appPromo.cta}
              <ArrowRight />
            </Link>
          </div>
        </div>
        <div className="relative md:justify-self-end">
          <div
            className="relative w-full max-w-[320px] mx-auto aspect-[9/16] rounded-[36px] overflow-hidden border border-border"
            style={{
              boxShadow:
                "0 30px 80px rgba(0,0,0,0.55), 0 1px 0 rgba(200,169,126,0.10) inset",
            }}
          >
            <img
              src={brand.assets.heroMobile}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(10,10,13,0.20) 0%, rgba(10,10,13,0.55) 70%, rgba(10,10,13,0.90) 100%)",
              }}
              aria-hidden
            />
            <div className="absolute inset-x-0 bottom-0 p-6 text-left">
              <p className="eyebrow text-accent/90">{brand.shortName}</p>
              <p className="serif text-[24px] leading-tight mt-2">
                Your driver in your pocket.
              </p>
            </div>
            {/* iPhone-ish notch hint */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-6 rounded-[14px] bg-black/85" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Final CTA ─────────────────────────────────────────────────────────
function FinalCta() {
  return (
    <section className="py-24 md:py-36 relative overflow-hidden">
      <img
        src={brand.assets.serviceInterior}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,10,13,0.85) 0%, rgba(10,10,13,0.7) 50%, rgba(10,10,13,0.9) 100%)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 mix-blend-multiply"
        style={{
          background:
            "radial-gradient(70% 80% at 50% 50%, rgba(200,169,126,0.15), transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative max-w-[1200px] mx-auto px-5 md:px-8 text-center">
        <h2 className="serif text-[34px] md:text-[58px] leading-[1.05] tracking-[-0.02em] max-w-[20ch] mx-auto">
          Your next ride should feel like an upgrade.
        </h2>
        <p className="mt-5 max-w-[48ch] mx-auto text-[15px] md:text-[17px] leading-[1.7] text-text/85">
          Confirm a pickup in under a minute. A real dispatcher reviews every booking.
        </p>
        <div className="mt-10 flex flex-wrap justify-center items-center gap-3">
          <Link
            to="/book"
            className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-[8px] bg-accent text-[#0A0A0D] text-[14px] font-semibold tracking-wide hover:bg-accent-strong active:scale-[0.98] transition-[transform,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Book a ride <ArrowRight />
          </Link>
          <a
            href={brand.phoneHref}
            className="inline-flex items-center justify-center h-12 px-5 rounded-[8px] border border-border hover:border-accent text-[14px] tracking-wide text-text/90 hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Call {brand.phone}
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-border py-12 md:py-16">
      <div className="max-w-[1200px] mx-auto px-5 md:px-8 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
        <div>
          <div className="flex items-center gap-3">
            <img
              src={brand.assets.appIcon}
              alt=""
              className="w-9 h-9 rounded-md"
            />
            <span className="serif text-[22px] leading-none">
              {brand.shortName}
            </span>
          </div>
          <p className="mt-4 text-[13px] leading-[1.7] text-muted max-w-[36ch]">
            {brand.fullName}. {brand.tagline}
          </p>
        </div>

        <div>
          <p className="eyebrow mb-3">Contact</p>
          <ul className="space-y-2 text-[14px]">
            <li>
              <a
                href={brand.phoneHref}
                className="text-text/90 hover:text-accent transition-colors"
              >
                {brand.phone}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${brand.email}`}
                className="text-text/90 hover:text-accent transition-colors break-all"
              >
                {brand.email}
              </a>
            </li>
            <li className="text-muted">{brand.serviceArea}</li>
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-3">Booking</p>
          <ul className="space-y-2 text-[14px]">
            <li>
              <Link
                to="/book"
                className="text-text/90 hover:text-accent transition-colors"
              >
                Book a ride
              </Link>
            </li>
            <li>
              <Link
                to="/install"
                className="text-text/90 hover:text-accent transition-colors"
              >
                Install the app
              </Link>
            </li>
            <li>
              <Link
                to="/login"
                className="text-text/90 hover:text-accent transition-colors"
              >
                Driver / staff sign in
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-5 md:px-8 mt-10 pt-6 border-t border-border text-[12px] text-muted flex flex-wrap justify-between gap-3">
        <span>
          © {new Date().getFullYear()} {brand.fullName}. All rights reserved.
        </span>
        <span>Licensed · insured · DOT compliant.</span>
      </div>
    </footer>
  );
}

// ── Icons (inline SVG) ────────────────────────────────────────────────
const ArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
    <path
      d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconShield = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="m8.5 12 2.5 2.5L15.5 10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconPlane = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M2 14.5 11 9V4a1 1 0 1 1 2 0v5l9 5.5-9-2v5l2 1.5v1L12 19l-3 1v-1l2-1.5v-5l-9 2Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

const IconTag = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M3 12V4h8l10 10-8 8L3 12Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" />
  </svg>
);

const IconClock = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M12 7v5l3 2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Larger pillar icons — 26px, slightly thicker stroke for the boxed
// treatment.
const IconShieldCheck = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path
      d="m8.5 12 2.5 2.5L15.5 10"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconStopwatch = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M9 3h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M12 3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="12" cy="14" r="7" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 10v4l2.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m18 7 2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const IconReceipt = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const IconPhone = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M10 18h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
