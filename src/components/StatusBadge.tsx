import type { RideStatus } from "../lib/types";

const MAP: Record<RideStatus, { label: string; color: string }> = {
  requested: { label: "Requested", color: "var(--text-muted)" },
  scheduled: { label: "Scheduled", color: "var(--text-muted)" },
  on_the_way: { label: "On the way", color: "var(--warn)" },
  arrived: { label: "At pickup", color: "var(--accent)" },
  in_progress: { label: "On board", color: "var(--accent)" },
  completed: { label: "Completed", color: "var(--success)" },
  cancelled: { label: "Cancelled", color: "var(--danger)" },
};

export function StatusBadge({ status }: { status: RideStatus }) {
  const s = MAP[status];
  return (
    <span
      className="chip tnum"
      style={{ color: s.color, background: "transparent" }}
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
