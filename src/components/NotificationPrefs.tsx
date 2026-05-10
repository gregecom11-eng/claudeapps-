// Per-user notification preferences card. Lets the user toggle which
// kinds of pushes they want, set quiet hours, and fire a test push to
// verify their device is wired up.
//
// Usable by all roles — owners see every kind, drivers/clients only
// see the kinds that target them.

import { useEffect, useMemo, useState } from "react";
import {
  getMyQuietHours,
  listMyNotificationPrefs,
  sendTestNotification,
  setNotificationPref,
  upsertMyQuietHours,
} from "../lib/api";
import { getPushState, type PushState } from "../lib/push";
import type { NotificationKind, UserRole } from "../lib/types";
import { Icon } from "./Icon";

type KindMeta = {
  id: NotificationKind;
  label: string;
  description: string;
  audience: UserRole[];
  alwaysOn?: boolean; // can't be turned off
};

const KINDS: KindMeta[] = [
  {
    id: "ride_created",
    label: "New booking landed",
    description:
      "A request came in from your public booking form. Bypasses quiet hours.",
    audience: ["owner"],
  },
  {
    id: "ride_assigned",
    label: "New ride assigned to you",
    description: "You were attached as the driver on a ride.",
    audience: ["driver"],
  },
  {
    id: "pickup_reminder",
    label: "90-minute pickup reminder",
    description:
      "Heads-up before each pickup. Sent automatically — fires once per ride.",
    audience: ["driver"],
  },
  {
    id: "ride_status_changed",
    label: "Ride status updates",
    description:
      "Driver on the way, arrived, in progress, completed. Owners see all; clients see updates on their own rides.",
    audience: ["owner", "client"],
  },
  {
    id: "ride_cancelled",
    label: "Ride cancellations",
    description:
      "A ride was cancelled. Always sent (bypasses quiet hours) — too important to miss.",
    audience: ["owner", "driver", "client"],
    alwaysOn: true,
  },
];

export function NotificationPrefs({
  role,
  flash,
}: {
  role: UserRole;
  flash: (m: string) => void;
}) {
  const [prefs, setPrefs] = useState<Record<NotificationKind, boolean>>(
    () =>
      Object.fromEntries(
        KINDS.map((k) => [k.id, true]),
      ) as Record<NotificationKind, boolean>,
  );
  const [loaded, setLoaded] = useState(false);
  const [qhStart, setQhStart] = useState("22:00");
  const [qhEnd, setQhEnd] = useState("07:00");
  const [qhEnabled, setQhEnabled] = useState(true);
  const [savingQh, setSavingQh] = useState(false);
  const [testing, setTesting] = useState(false);
  const [pushState, setPushState] = useState<PushState>("off");

  // Watch push state so the "Send test" button can be greyed out with a
  // helpful hint when the user hasn't subscribed yet — fixes the silent
  // no-op the previous version showed.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      getPushState()
        .then((s) => {
          if (!cancelled) setPushState(s);
        })
        .catch(() => {
          if (!cancelled) setPushState("unsupported");
        });
    };
    refresh();
    window.addEventListener("sdl:pushstatechange", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("sdl:pushstatechange", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    Promise.all([listMyNotificationPrefs(), getMyQuietHours()])
      .then(([list, qh]) => {
        const next = { ...prefs };
        for (const p of list) next[p.kind] = p.enabled;
        setPrefs(next);
        if (qh) {
          const s = qh.start_local.slice(0, 5);
          const e = qh.end_local.slice(0, 5);
          setQhStart(s);
          setQhEnd(e);
          setQhEnabled(s !== e);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleKinds = useMemo(
    () => KINDS.filter((k) => k.audience.includes(role)),
    [role],
  );

  const toggle = async (kind: NotificationKind, enabled: boolean) => {
    setPrefs((p) => ({ ...p, [kind]: enabled }));
    try {
      await setNotificationPref(kind, enabled);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Save failed");
      setPrefs((p) => ({ ...p, [kind]: !enabled }));
    }
  };

  const saveQuietHours = async () => {
    setSavingQh(true);
    try {
      const tz =
        Intl.DateTimeFormat().resolvedOptions().timeZone ??
        "America/Los_Angeles";
      // Disabled = start equals end (signals "no quiet hours" to the
      // dispatcher).
      const start = qhEnabled ? qhStart : "00:00";
      const end = qhEnabled ? qhEnd : "00:00";
      await upsertMyQuietHours({
        start_local: `${start}:00`,
        end_local: `${end}:00`,
        tz,
      });
      flash("Quiet hours saved");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingQh(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const r = await sendTestNotification();
      if (r.devices === 0) {
        flash(
          "No subscribed devices. Turn on push above first, then try again.",
        );
      } else if (r.sent > 0) {
        flash(
          `Test sent to ${r.sent}/${r.devices} device${
            r.devices === 1 ? "" : "s"
          }`,
        );
      } else {
        flash("All devices failed. Check the inbox below for details.");
      }
    } catch (e) {
      flash(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  };

  if (!loaded) {
    return (
      <div className="p-5 text-muted text-sm">Loading preferences…</div>
    );
  }

  return (
    <div>
      {/* Per-kind toggles */}
      <ul>
        {visibleKinds.map((k, i) => {
          const on = prefs[k.id];
          const locked = k.alwaysOn;
          return (
            <li
              key={k.id}
              className="flex items-start gap-3 px-4 py-3.5"
              style={{
                borderTop: i === 0 ? "none" : "1px solid var(--border)",
              }}
            >
              <span
                className="inline-grid place-items-center mt-0.5"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color:
                    on || locked
                      ? "var(--accent)"
                      : "var(--text-muted)",
                  flexShrink: 0,
                }}
              >
                <Icon name="bell" size={14} />
              </span>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {k.label}
                  {locked ? (
                    <span
                      className="chip ml-2"
                      style={{
                        fontSize: 10,
                        background: "transparent",
                        color: "var(--text-muted)",
                      }}
                      title="Always on — too important to miss."
                    >
                      Always on
                    </span>
                  ) : null}
                </div>
                <div
                  className="text-muted mt-0.5"
                  style={{ fontSize: 12.5, lineHeight: 1.5 }}
                >
                  {k.description}
                </div>
              </div>
              <SwitchToggle
                checked={locked ? true : on}
                disabled={locked}
                onChange={(v) => toggle(k.id, v)}
              />
            </li>
          );
        })}
      </ul>

      {/* Quiet hours */}
      <div
        className="p-4 grid gap-3"
        style={{
          borderTop: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="inline-grid place-items-center mt-0.5"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: qhEnabled ? "var(--accent)" : "var(--text-muted)",
              flexShrink: 0,
            }}
          >
            <Icon name="moon" size={14} />
          </span>
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 14, fontWeight: 600 }}>Quiet hours</div>
            <div
              className="text-muted mt-0.5"
              style={{ fontSize: 12.5, lineHeight: 1.5 }}
            >
              We won't push during this window in your local time.
              Cancellations and new bookings still come through.
            </div>
          </div>
          <SwitchToggle
            checked={qhEnabled}
            onChange={(v) => setQhEnabled(v)}
          />
        </div>
        {qhEnabled ? (
          <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
            <input
              type="time"
              className="field tnum"
              value={qhStart}
              onChange={(e) => setQhStart(e.target.value)}
            />
            <span className="text-muted text-xs">to</span>
            <input
              type="time"
              className="field tnum"
              value={qhEnd}
              onChange={(e) => setQhEnd(e.target.value)}
            />
            <button
              onClick={saveQuietHours}
              disabled={savingQh}
              className="inline-flex items-center justify-center h-9 px-3 rounded-[8px] text-[13px] font-medium"
              style={{
                background: "var(--accent)",
                color: "#15161B",
                border: "1px solid var(--accent-strong)",
              }}
            >
              {savingQh ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              onClick={saveQuietHours}
              disabled={savingQh}
              className="inline-flex items-center justify-center h-9 px-3 rounded-[8px] text-[13px]"
              style={{
                background: "transparent",
                color: "var(--text)",
                border: "1px solid var(--border)",
              }}
            >
              {savingQh ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      {/* Self-test */}
      <div
        className="p-4 flex items-center justify-between gap-3 flex-wrap"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          {pushState === "on"
            ? "Send yourself a test push right now to verify this device is subscribed."
            : pushState === "denied"
            ? "Notifications are blocked in your browser settings — re-enable them and reload."
            : pushState === "unsupported"
            ? "This browser doesn't support push notifications."
            : "Turn on push notifications above first, then come back to send a test."}
        </div>
        <button
          onClick={sendTest}
          disabled={testing || pushState !== "on"}
          title={
            pushState !== "on"
              ? "Turn on push notifications first."
              : undefined
          }
          className="inline-flex items-center gap-2 h-9 px-3 rounded-[8px] text-[13px] font-medium"
          style={{
            background: "transparent",
            color: "var(--text)",
            border: "1px solid var(--border)",
            opacity: pushState !== "on" ? 0.5 : 1,
            cursor:
              testing || pushState !== "on" ? "not-allowed" : "pointer",
          }}
        >
          <Icon name="bell" size={13} />
          {testing ? "Sending…" : "Send test"}
        </button>
      </div>
    </div>
  );
}

function SwitchToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative"
      style={{
        width: 40,
        height: 24,
        borderRadius: 999,
        background: checked ? "var(--accent)" : "var(--surface-2)",
        border: `1px solid ${
          checked ? "var(--accent-strong)" : "var(--border)"
        }`,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 120ms ease, border-color 120ms ease",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: checked ? "#15161B" : "var(--text-muted)",
          transition: "left 140ms ease",
        }}
      />
    </button>
  );
}
