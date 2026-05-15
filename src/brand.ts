// Brand-wide configuration. Edit THIS FILE (plus the CSS variables in
// src/index.css and the assets in public/brand/) to white-label the
// app for a different operator. No component should hardcode the
// brand name, phone, email, or hex color — read from here.

export const brand = {
  // Identity
  shortName: "SDLuxury",
  fullName: "SDLuxury Transportation",
  tagline: "San Diego's chauffeur-on-call.",

  // Public contact (used on the landing page + footer)
  phone: "+1 (619) 555-0000",
  phoneHref: "tel:+16195550000",
  email: "concierge@sdluxury.example",
  serviceArea: "San Diego County · LAX, SAN, BUR, LGB",

  // Landing-page copy
  hero: {
    eyebrow: "Private chauffeur service",
    headline: "Arrive on time.\nArrive in style.",
    sub:
      "Black-car, SUV, and executive transfers across Southern California. " +
      "Book in 60 seconds — your driver will meet you at the curb.",
    primaryCta: "Book a ride",
    secondaryCta: "How it works",
  },

  trustStats: [
    { label: "On-time pickups", value: "99.4%" },
    { label: "Years of service", value: "12+" },
    { label: "Repeat clients", value: "1,800+" },
  ],

  services: [
    {
      id: "airport",
      title: "Airport transfers",
      description:
        "SAN, LAX, BUR, LGB, VNY. Flight tracked end-to-end — your driver is curbside the moment you land.",
      tripType: "airport",
    },
    {
      id: "one_way",
      title: "Point-to-point",
      description:
        "A clean single-leg trip with a black SUV or sedan. Confirmed driver, fixed price.",
      tripType: "one_way",
    },
    {
      id: "hourly",
      title: "Hourly · as directed",
      description:
        "Multi-stop business or evening service. The driver stays with you — no app pings between stops.",
      tripType: "hourly",
    },
    {
      id: "round_trip",
      title: "Round trip",
      description:
        "Same vehicle waits and returns. Ideal for medical appointments, meetings, and events.",
      tripType: "round_trip",
    },
  ],

  // Why-us pillars (4 trust pillars, no photos — pure typography)
  pillars: [
    {
      title: "Vetted chauffeurs",
      body: "Every driver is background-checked, drug-tested, and trained in concierge-level service. No rideshare pool.",
    },
    {
      title: "Punctuality, guaranteed",
      body: "We track your flight or schedule end-to-end. If a delay is on our side, the next ride is on us.",
    },
    {
      title: "Transparent pricing",
      body: "Quote up-front. No surge, no hidden surcharges, no per-minute meter. The price you see is the price you pay.",
    },
    {
      title: "24/7 dispatch",
      body: "A real dispatcher answers — not a chatbot. Reach us by phone or text at any hour, any day.",
    },
  ],

  // App promo section
  appPromo: {
    eyebrow: "Take it with you",
    headline: "Your driver in your pocket.",
    body:
      "Install the app for one-tap booking, live driver tracking, and trip receipts. " +
      "Works offline once installed; no app store required.",
    cta: "Install on your phone",
  },

  // How-it-works steps (landing page)
  steps: [
    {
      n: 1,
      title: "Tell us when and where",
      body: "Pick a trip type, pickup time, and address. About 60 seconds.",
    },
    {
      n: 2,
      title: "We confirm by text",
      body: "A dispatcher reviews and confirms in under 30 minutes — no automated black-box pricing.",
    },
    {
      n: 3,
      title: "Your driver is there",
      body: "We track your flight or itinerary. Your chauffeur arrives early, in uniform, with the vehicle prepped.",
    },
  ],

  // Asset paths under /public — keep filenames stable across brand
  // swaps so swapping = drop new image files with the same names.
  assets: {
    heroDesktop: "/brand/hero-desktop.jpg",
    heroMobile: "/brand/hero-mobile.jpg",
    serviceAirport: "/brand/service-airport.jpg",
    serviceInterior: "/brand/service-interior.jpg",
    appIcon: "/brand/app-icon.png",
  },
} as const;
