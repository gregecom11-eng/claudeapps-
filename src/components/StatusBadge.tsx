import type { RideStatus } from "../lib/types";

const LABEL: Record<RideStatus, string> = {
  requested: "Requested",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: RideStatus }) {
  return <span className={`badge badge-${status}`}>{LABEL[status]}</span>;
}
