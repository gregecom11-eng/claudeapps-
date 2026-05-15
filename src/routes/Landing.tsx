// Public marketing landing page (no auth required).
//
// A visitor — typically a referred client from one of Michael's
// assistants — lands here and decides in <10 seconds whether this
// is a real, trustworthy operator. Hero photo, single CTA to /book,
// short trust signals, four service types, three-step "how it
// works", contact. No login wall, no marketing fluff.

import { Link } from "react-router-dom";
import { brand } from "../brand";

export function Landing() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <LandingNav />
      <Hero />
      <TrustStrip />
      <Services />
      <HowItWorks />
      <FinalCta />
      <Footer />
    </div>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────
function LandingNav() {
  return (
    <nav className="sticky top-0 z-30 backdrop-blur-md bg-bg/70 border-b border-border">
      <div className="max-w-[1200px] mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={brand.assets.appIcon}
            alt=""
            className="w-8 h-8 rounded-md"
          />
          <span className="serif text-[20px] leading-none">
            {brand.shortName}
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <a
            href={brand.phoneHref}
            className="hidden sm:inline text-[13px] text-muted hover:text-text transition-colors"
          >
            {brand.phone}
          </a>
          <Link
            to="/book"
            className="inline-flex items-center justify-center h-9 px-4 rounded-[8px] bg-accent text-[#0A0A0D] text-[13px] font-semibold tracking-wide hover:bg-accent-strong transition-colors"
          >
            Book a ride
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background photo — desktop on >=md, mobile on smaller */}
      <picture>
        <source media="(min-width: 768px)" srcSet={brand.assets.heroDesktop} />
        <img
          src={brand.assets.heroMobile}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      </picture>
      {/* Color treatment + dark gradient for legibility */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,10,13,0.35) 0%, rgba(10,10,13,0.75) 60%, rgba(10,10,13,0.95) 100%)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 mix-blend-multiply"
        style={{
          background:
            "radial-gradient(60% 80% at 30% 40%, rgba(200,169,126,0.18), transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative max-w-[1200px] mx-auto px-5 md:px-8 pt-24 md:pt-36 pb-20 md:pb-40">
        <p className="eyebrow text-accent/90 mb-5">
          {brand.hero.eyebrow}
        </p>
        <h1
          className="serif text-[44px] sm:text-[60px] md:text-[88px] leading-[0.95] tracking-[-0.03em] max-w-[14ch]"
          style={{ textShadow: "0 2px 24px rgba(0,0,0,0.45)" }}
        >
          {brand.hero.headline.split("\n").map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </h1>
        <p className="mt-6 max-w-[52ch] text-[15px] md:text-[17px] leading-[1.7] text-text/85">
          {brand.hero.sub}
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            to="/book"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-[8px] bg-accent text-[#0A0A0D] text-[14px] font-semibold tracking-wide hover:bg-accent-strong active:scale-[0.98] transition-[transform,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {brand.hero.primaryCta}
            <ArrowRight />
          </Link>
          <a
            href="#how"
            className="inline-flex items-center justify-center h-12 px-5 rounded-[8px] border border-border hover:border-accent text-[14px] tracking-wide text-text/90 hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {brand.hero.secondaryCta}
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Trust strip ───────────────────────────────────────────────────────
function TrustStrip() {
  return (
    <section className="border-y border-border bg-surface/50">
      <div className="max-w-[1200px] mx-auto px-5 md:px-8 py-10 md:py-14 grid grid-cols-3 gap-4 md:gap-12">
        {brand.trustStats.map((s) => (
          <div key={s.label} className="text-center md:text-left">
            <div className="display-num text-[36px] md:text-[56px] text-accent">
              {s.value}
            </div>
            <div className="mt-1 text-[11px] md:text-[12px] uppercase tracking-[0.18em] text-muted">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Services ──────────────────────────────────────────────────────────
function Services() {
  return (
    <section className="py-20 md:py-32">
      <div className="max-w-[1200px] mx-auto px-5 md:px-8">
        <p className="eyebrow text-accent mb-4">What we run</p>
        <h2 className="serif text-[34px] md:text-[52px] leading-[1.05] tracking-[-0.02em] max-w-[18ch]">
          Four kinds of trips. One standard.
        </h2>
        <p className="mt-4 max-w-[58ch] text-[15px] md:text-[16px] leading-[1.7] text-muted">
          Black SUV or executive sedan, full-time chauffeur, dispatcher
          confirmation. No surge pricing, no rideshare driver pool.
        </p>

        <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          {brand.services.map((svc, i) => (
            <article
              key={svc.id}
              className="group surface rounded-[14px] p-6 md:p-8 hover:border-accent/60 transition-colors relative overflow-hidden"
            >
              {/* First card gets the airport photo, others get interior */}
              {i === 0 && (
                <ServicePhoto src={brand.assets.serviceAirport} />
              )}
              {i === 2 && (
                <ServicePhoto src={brand.assets.serviceInterior} />
              )}
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
    <div className="absolute -right-8 -top-8 w-[160px] h-[160px] md:w-[200px] md:h-[200px] rounded-full overflow-hidden opacity-25 group-hover:opacity-40 transition-opacity">
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
    <section id="how" className="py-20 md:py-32 border-t border-border bg-surface/40">
      <div className="max-w-[1200px] mx-auto px-5 md:px-8">
        <p className="eyebrow text-accent mb-4">How it works</p>
        <h2 className="serif text-[34px] md:text-[52px] leading-[1.05] tracking-[-0.02em] max-w-[18ch]">
          Three steps, then we take it from there.
        </h2>

        <ol className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {brand.steps.map((step) => (
            <li
              key={step.n}
              className="surface-2 rounded-[14px] p-6 md:p-8"
            >
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
          Confirm a pickup in under a minute. A real dispatcher reviews
          every booking.
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
              className="w-8 h-8 rounded-md"
            />
            <span className="serif text-[20px] leading-none">
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
              <Link to="/book" className="text-text/90 hover:text-accent transition-colors">
                Book a ride
              </Link>
            </li>
            <li>
              <Link to="/install" className="text-text/90 hover:text-accent transition-colors">
                Install the app
              </Link>
            </li>
            <li>
              <Link to="/login" className="text-text/90 hover:text-accent transition-colors">
                Driver / staff sign in
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-5 md:px-8 mt-10 pt-6 border-t border-border text-[12px] text-muted flex flex-wrap justify-between gap-3">
        <span>© {new Date().getFullYear()} {brand.fullName}. All rights reserved.</span>
        <span>Licensed · insured · DOT compliant.</span>
      </div>
    </footer>
  );
}

// ── Tiny icon ─────────────────────────────────────────────────────────
function ArrowRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className="transition-transform group-hover:translate-x-0.5"
    >
      <path
        d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
