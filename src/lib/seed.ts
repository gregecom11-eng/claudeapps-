import type { AppState } from "./types";
import { uid } from "./storage";

// Mock data used when localStorage is empty. Useful for first-run UX and
// for the `npm run seed` script (which writes a backup JSON file).
export function makeSeedState(): AppState {
  const now = Date.now();
  const iso = (offsetMin: number) =>
    new Date(now + offsetMin * 60_000).toISOString();

  return {
    tasks: [
      {
        id: uid(),
        title: "Confirm Friday airport pickup (JFK → Midtown)",
        status: "in_progress",
        notes: "Client: A. Patel · 2 pax · meet at T4 arrivals",
        updatedAt: iso(-15),
      },
      {
        id: uid(),
        title: "Restock water + mints in Fleet 3",
        status: "planned",
        updatedAt: iso(-120),
      },
      {
        id: uid(),
        title: "Quarterly insurance renewal paperwork",
        status: "planned",
        updatedAt: iso(-240),
      },
      {
        id: uid(),
        title: "Driver onboarding: M. Rivera",
        status: "done",
        notes: "Background check cleared",
        updatedAt: iso(-1440),
      },
    ],
    events: [
      {
        id: uid(),
        title: "Wedding transfer — Hudson Valley",
        datetime: iso(60 * 26),
        location: "Beacon, NY",
        notes: "Stretch + sedan, 6 pax total",
        status: "scheduled",
      },
      {
        id: uid(),
        title: "Corporate roadshow — JPM",
        datetime: iso(60 * 50),
        location: "Manhattan",
        status: "scheduled",
      },
      {
        id: uid(),
        title: "Prom run — Trinity HS",
        datetime: iso(-60 * 20),
        location: "Brooklyn",
        notes: "Completed, no incidents",
        status: "completed",
      },
    ],
    agentLogs: [
      {
        id: uid(),
        source: "agent",
        message: "Booted. Synced calendar feed (3 events).",
        timestamp: iso(-5),
      },
      {
        id: uid(),
        source: "dispatch",
        message: "Driver M. Rivera marked Fleet 2 ready.",
        timestamp: iso(-22),
      },
    ],
    settings: { pollIntervalSec: 30, theme: "system", syncEnabled: false },
  };
}
