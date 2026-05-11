import type { RideStatus } from "../lib/types";

const MAP: Record<RideStatus, { label: string; color: string }> = {
  requested: { label: "Requested", color: "var(--text-muted)" },
  scheduled: { label: "Booked", color: "var(--text-muted)" },
  on_the_way: { label: "Rolling", color: "var(--warn)" },
  arrived: { label: "At pickup", color: "var(--accent)" },
  in_progress: { label: "On board", color: "var(--accent)" },
  completed: { label: "Done", color: "var(--success)" },
  cancelled: { label: "Cancelled", color: "var(--danger)" },
};

// Subtle eyebrow-style badge: dot + uppercase tracked label, tinted
// background so the strongest in-card colour is reserved for primary
// CTAs. Use `subtle` for in-list rows where a softer treatment is wanted.
export function StatusBadge({
  status,
  subtle = false,
}: {
  status: RideStatus;
  subtle?: boolean;
}) {
  const s = MAP[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 shrink-0"
      style={{
        color: s.color,
        background: subtle
          ? "transparent"
          : `color-mix(in oklab, ${s.color} 14%, transparent)`,
        border: subtle
          ? "none"
          : `1px solid color-mix(in oklab, ${s.color} 28%, var(--border))`,
        borderRadius: 999,
        padding: subtle ? "0" : "3px 10px",
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        lineHeight: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: s.color,
          display: "inline-block",
        }}
      />
      {s.label}
    </span>
  );
}
