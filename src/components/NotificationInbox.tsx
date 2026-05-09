// Owner-only: a live view of every notification the dispatcher
// processed. Useful for "did the driver actually get pinged?" debugging
// and for spot-checking that the routing rules do what you think.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listNotificationInbox } from "../lib/api";
import type {
  NotificationInboxRow,
  NotificationKind,
  NotificationStatus,
} from "../lib/types";
import { Icon } from "./Icon";

const KIND_LABEL: Record<NotificationKind, string> = {
  ride_created: "New booking",
  ride_assigned: "Driver assigned",
  ride_status_changed: "Status update",
  ride_cancelled: "Cancellation",
  pickup_reminder: "Pickup reminder",
};

const STATUS_COLOR: Record<NotificationStatus, string> = {
  pending: "var(--text-muted)",
  sent: "var(--success)",
  failed: "var(--danger)",
  skipped: "var(--warn)",
};

export function NotificationInbox() {
  const [rows, setRows] = useState<NotificationInboxRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | NotificationStatus>("all");

  const reload = () =>
    listNotificationInbox({ limit: 100 })
      .then((r) => {
        setRows(r);
        setLoadError(null);
      })
      .catch((e) => {
        setLoadError(
          e instanceof Error
            ? e.message
            : "Notification inbox isn't available yet.",
        );
        setRows([]);
      });

  useEffect(() => {
    reload();
    const t = window.setInterval(reload, 15_000);
    return () => window.clearInterval(t);
  }, []);

  const filtered = rows
    ? filter === "all"
      ? rows
      : rows.filter((r) => r.status === filter)
    : null;

  return (
    <div>
      <div
        className="flex items-center gap-2 p-3 flex-wrap"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {(["all", "sent", "skipped", "failed", "pending"] as const).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="inline-flex items-center h-7 px-2.5 rounded-[7px] text-[12px] font-medium"
              style={{
                background:
                  filter === f
                    ? "color-mix(in oklab, var(--accent) 18%, transparent)"
                    : "transparent",
                color:
                  filter === f ? "var(--accent)" : "var(--text-muted)",
                border: `1px solid ${
                  filter === f
                    ? "color-mix(in oklab, var(--accent) 50%, var(--border))"
                    : "var(--border)"
                }`,
                textTransform: "capitalize",
              }}
            >
              {f}
            </button>
          ),
        )}
        <button
          onClick={reload}
          className="ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[7px] text-[12px]"
          style={{
            background: "transparent",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
          }}
          title="Refresh"
        >
          <Icon name="swap" size={11} /> Refresh
        </button>
      </div>

      {loadError ? (
        <div className="p-5 text-muted text-sm">
          The notifications inbox isn't ready yet — run{" "}
          <code style={{ fontSize: 12 }}>supabase/08_notifications.sql</code>{" "}
          in your Supabase SQL editor to enable it.
        </div>
      ) : filtered === null ? (
        <div className="p-5 text-muted text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="p-5 text-muted text-sm">
          {rows && rows.length > 0
            ? "No notifications match this filter."
            : "No notifications yet. They'll show up here as the dispatcher runs."}
        </div>
      ) : (
        <ul>
          {filtered.map((r, i) => (
            <li
              key={r.id}
              className="px-4 py-3"
              style={{
                borderTop: i === 0 ? "none" : "1px solid var(--border)",
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="inline-grid place-items-center mt-0.5"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: STATUS_COLOR[r.status],
                    flexShrink: 0,
                  }}
                >
                  <Icon
                    name={
                      r.status === "sent"
                        ? "check"
                        : r.status === "failed"
                          ? "x"
                          : r.status === "skipped"
                            ? "info"
                            : "clock"
                    }
                    size={14}
                  />
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className="flex items-center gap-2 flex-wrap"
                    style={{ minHeight: 20 }}
                  >
                    <span
                      className="chip"
                      style={{
                        background: "transparent",
                        color: "var(--text-muted)",
                        fontSize: 10.5,
                      }}
                    >
                      {KIND_LABEL[r.kind]}
                    </span>
                    <span
                      className="chip"
                      style={{
                        background: "transparent",
                        color: STATUS_COLOR[r.status],
                        fontSize: 10.5,
                        borderColor: `color-mix(in oklab, ${STATUS_COLOR[r.status]} 35%, var(--border))`,
                        textTransform: "capitalize",
                      }}
                    >
                      {r.status}
                    </span>
                    <span
                      className="text-muted tnum"
                      style={{ fontSize: 11.5 }}
                    >
                      {formatRelative(r.created_at)}
                    </span>
                  </div>
                  <div
                    className="mt-1 truncate"
                    style={{ fontSize: 13.5, fontWeight: 600 }}
                  >
                    {r.payload.title}
                  </div>
                  <div
                    className="text-muted truncate"
                    style={{ fontSize: 12 }}
                  >
                    {r.payload.body}
                  </div>
                  <div
                    className="text-muted mt-1"
                    style={{ fontSize: 11.5 }}
                  >
                    To: {summarizeRecipients(r.recipients)}
                    {r.last_error ? (
                      <>
                        {" · "}
                        <span style={{ color: "var(--danger)" }}>
                          {r.last_error}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                {r.ride_id ? (
                  <Link
                    to={`/rides/${r.ride_id}`}
                    title="Open ride"
                    aria-label="Open ride"
                    className="inline-grid place-items-center"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      color: "var(--text-muted)",
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="arrow" size={14} />
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function summarizeRecipients(
  recips: NotificationInboxRow["recipients"],
): string {
  if (!Array.isArray(recips) || recips.length === 0) return "no one";
  const parts: string[] = [];
  let owners = 0;
  let users = 0;
  for (const r of recips) {
    if (r.role === "owner") owners++;
    else if (r.user_id) users++;
  }
  if (owners > 0) parts.push("owners");
  if (users > 0) parts.push(`${users} user${users === 1 ? "" : "s"}`);
  return parts.join(" + ");
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
