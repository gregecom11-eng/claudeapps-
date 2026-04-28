// Writes a backup JSON file with mock data to stdout (or a path).
// Usage:  node scripts/seed.mjs > seed.json
//         node scripts/seed.mjs ./seed.json

import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const now = Date.now();
const iso = (m) => new Date(now + m * 60_000).toISOString();
const id = () => randomUUID();

const state = {
  tasks: [
    { id: id(), title: "Confirm Friday airport pickup (JFK → Midtown)", status: "in_progress", notes: "Client: A. Patel · 2 pax", updatedAt: iso(-15) },
    { id: id(), title: "Restock water + mints in Fleet 3", status: "planned", updatedAt: iso(-120) },
    { id: id(), title: "Driver onboarding: M. Rivera", status: "done", updatedAt: iso(-1440) },
  ],
  events: [
    { id: id(), title: "Wedding transfer — Hudson Valley", datetime: iso(60 * 26), location: "Beacon, NY", status: "scheduled" },
    { id: id(), title: "Corporate roadshow — JPM", datetime: iso(60 * 50), location: "Manhattan", status: "scheduled" },
    { id: id(), title: "Prom run — Trinity HS", datetime: iso(-60 * 20), location: "Brooklyn", status: "completed" },
  ],
  agentLogs: [
    { id: id(), source: "agent", message: "Booted. Synced calendar feed.", timestamp: iso(-5) },
  ],
  settings: { pollIntervalSec: 30, theme: "system", syncEnabled: false },
};

const out = process.argv[2];
const text = JSON.stringify(state, null, 2);
if (out) {
  writeFileSync(out, text);
  console.error(`Wrote ${out}`);
} else {
  process.stdout.write(text + "\n");
}
