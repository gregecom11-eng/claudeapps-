// PII redaction for the dashboard activity feed (`events` table) and
// any other surface a human reads.
//
// The audit table stores the FULL pre/post snapshots. These helpers
// shape the human-readable version only.

const PHONE_DIGITS = /\d/g;

// Show last 4 digits of a phone, masked. Accepts any common format.
//   "+1 (619) 555-1086" -> "***-***-1086"
//   "619-555-1086"      -> "***-***-1086"
//   "5551086"           -> "***-1086"
export function redactPhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 4) return digits.replace(PHONE_DIGITS, "*");
  const last4 = digits.slice(-4);
  if (digits.length >= 10) return `***-***-${last4}`;
  return `***-${last4}`;
}

// Show first letter + domain.
//   "greg@gmail.com"       -> "g***@gmail.com"
//   "g@example.com"        -> "g***@example.com"
//   anything malformed     -> "***"
export function redactEmail(value: string | null | undefined): string {
  if (!value) return "";
  const at = value.indexOf("@");
  if (at <= 0 || at === value.length - 1) return "***";
  const first = value[0];
  const domain = value.slice(at);
  return `${first}***${domain}`;
}

// Show city only.
//   "11125 Sands Ave, Newport Beach, CA 92660" -> "Newport Beach, CA"
//   "Newport Beach"                            -> "Newport Beach"
// Heuristic: an address is comma-delimited; we keep the city + state and
// drop the street + ZIP. If we can't find structure, fall back to "***".
export function redactAddress(value: string | null | undefined): string {
  if (!value) return "";
  const parts = value.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return "***";
  if (parts.length === 1) return parts[0];
  // City is usually the second-to-last token; state (+ optional zip) is last.
  const city = parts[parts.length - 2];
  const stateAndZip = parts[parts.length - 1];
  // Strip the ZIP off the state token if there is one.
  const stateOnly = stateAndZip.replace(/\s*\d{5}(-\d{4})?$/, "");
  return stateOnly ? `${city}, ${stateOnly}` : city;
}

// Build a human-readable change list for the activity feed.
// `changes` is { fieldName: { before, after } }. Field names are mapped
// to PII-aware formatters; unknown fields are shown as-is, JSON-stringified.
export function summarizeRideChanges(
  passengerName: string,
  changes: Record<string, { before: unknown; after: unknown }>,
): string {
  return summarizeChanges(passengerName, changes);
}

// Same shape as summarizeRideChanges; works for any entity (clients,
// drivers). The first argument is the subject label that prefixes the
// summary (e.g. "Greg Vazquez", "Client Greg Vazquez").
export function summarizeChanges(
  subject: string,
  changes: Record<string, { before: unknown; after: unknown }>,
): string {
  const parts: string[] = [];
  for (const [field, { before, after }] of Object.entries(changes)) {
    parts.push(formatFieldChange(field, before, after));
  }
  if (parts.length === 0) return `${subject}: no changes.`;
  return `${subject}: ${parts.join("; ")}.`;
}

function formatFieldChange(
  field: string,
  before: unknown,
  after: unknown,
): string {
  const fmt = redactorFor(field);
  const b = fmt(before);
  const a = fmt(after);
  return `${humanFieldName(field)} ${b || "∅"} → ${a || "∅"}`;
}

function redactorFor(field: string): (v: unknown) => string {
  switch (field) {
    case "passenger_phone":
    case "phone":
      return (v) => redactPhone(v as string);
    case "passenger_email":
    case "email":
      return (v) => redactEmail(v as string);
    case "pickup_address":
    case "dropoff_address":
    case "home_address":
      return (v) => redactAddress(v as string);
    case "fare_cents":
    case "gratuity_cents":
    case "parking_cents":
    case "total_cents":
      return (v) =>
        typeof v === "number" ? `$${(v / 100).toFixed(2)}` : String(v ?? "");
    case "pickup_at":
      return (v) => (typeof v === "string" ? formatLocal(v) : String(v ?? ""));
    default:
      return (v) =>
        v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
  }
}

function humanFieldName(field: string): string {
  return field.replace(/_/g, " ");
}

const BUSINESS_TZ = "America/Los_Angeles";
function formatLocal(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
