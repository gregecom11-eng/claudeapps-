import type { Driver, Ride, Vehicle } from "./types";

// Build a minimal RFC 5545 .ics for one ride. Imports cleanly into Apple
// Calendar, Google Calendar, Outlook.

function escapeICS(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function fmt(d: Date): string {
  // Basic UTC format: YYYYMMDDTHHMMSSZ
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function rideToICS(
  ride: Ride,
  driver: Driver | null,
  vehicle: Vehicle | null,
): string {
  const start = new Date(ride.pickup_at);
  // Default duration: 90 min if no end-of-trip is recorded.
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  const summary = `Ride · ${ride.passenger_name}`;
  const desc = [
    `Passenger: ${ride.passenger_name}`,
    ride.passenger_phone ? `Phone: ${ride.passenger_phone}` : null,
    `Pickup: ${ride.pickup_address}`,
    ride.dropoff_address ? `Dropoff: ${ride.dropoff_address}` : null,
    ride.flight_number
      ? `Flight: ${ride.flight_airline ?? ""} ${ride.flight_number}`
      : null,
    driver ? `Driver: ${driver.full_name}` : null,
    vehicle ? `Vehicle: ${vehicle.display_name}` : null,
    ride.notes ? `Notes: ${ride.notes}` : null,
  ]
    .filter(Boolean)
    .join("\\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SDLuxury Operations//Ride//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ride.id}@sdluxury`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${escapeICS(ride.pickup_address)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Ride pickup in 90 minutes",
    "TRIGGER:-PT90M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

export function downloadICS(
  ride: Ride,
  driver: Driver | null,
  vehicle: Vehicle | null,
): void {
  const text = rideToICS(ride, driver, vehicle);
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ride-${ride.id.slice(0, 8)}-${ride.passenger_name
    .replace(/\W+/g, "-")
    .slice(0, 24)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
