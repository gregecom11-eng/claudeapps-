import { useStore } from "../hooks/useStore";

export function ActivityFeed({ limit }: { limit?: number }) {
  const { state } = useStore();
  const items = limit ? state.agentLogs.slice(0, limit) : state.agentLogs;

  if (items.length === 0) {
    return <div className="muted">No activity yet.</div>;
  }

  return (
    <ul className="stack-sm activity">
      {items.map((log) => (
        <li key={log.id} className="row gap-sm activity-row">
          <span className={`tag tag-${log.source}`}>{log.source}</span>
          <span className="grow">{log.message}</span>
          <span className="muted small">{relTime(log.timestamp)}</span>
        </li>
      ))}
    </ul>
  );
}

function relTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}
