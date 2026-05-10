import { useEffect, useState } from "react";
import {
  disablePush,
  enablePush,
  getPushState,
  pushSupported,
  type PushState,
} from "../lib/push";
import { Icon } from "./Icon";

// "Enable notifications" toggle. Drop into DriverProfile or owner Settings.
// On = browser is subscribed AND server has the subscription on file.
export function PushToggle({ hint }: { hint?: string }) {
  const [state, setState] = useState<PushState>("off");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPushState().then(setState).catch(() => setState("unsupported"));
  }, []);

  const turnOn = async () => {
    setBusy(true);
    setError(null);
    try {
      await enablePush();
      setState("on");
      window.dispatchEvent(new Event("sdl:pushstatechange"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to enable");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setError(null);
    try {
      await disablePush();
      setState("off");
      window.dispatchEvent(new Event("sdl:pushstatechange"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disable");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-[10px] p-4 flex items-center gap-3"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        className="inline-grid place-items-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          color:
            state === "on" ? "var(--success)" : "var(--text-muted)",
        }}
      >
        <Icon name="bell" size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          Push notifications
        </div>
        <div
          className="text-muted"
          style={{ fontSize: 12, lineHeight: 1.5 }}
        >
          {state === "unsupported" || !pushSupported()
            ? "This browser doesn't support push."
            : state === "denied"
            ? "Blocked in your browser settings."
            : state === "on"
            ? "On — you'll get pickup reminders and new-booking alerts."
            : hint ??
              "Get a heads-up 90 min before each pickup. Free, no SMS."}
        </div>
        {error ? (
          <div
            className="mt-1 text-danger"
            style={{ fontSize: 12 }}
          >
            {error}
          </div>
        ) : null}
      </div>
      {state === "on" ? (
        <button
          onClick={turnOff}
          disabled={busy}
          className="inline-flex items-center justify-center h-9 px-3 rounded-[8px] text-[13px] font-medium"
          style={{
            background: "transparent",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
        >
          {busy ? "…" : "Turn off"}
        </button>
      ) : state === "denied" || state === "unsupported" ? null : (
        <button
          onClick={turnOn}
          disabled={busy}
          className="inline-flex items-center justify-center h-9 px-3 rounded-[8px] text-[13px] font-semibold"
          style={{
            background: "var(--accent)",
            color: "#15161B",
            border: "1px solid var(--accent-strong)",
          }}
        >
          {busy ? "…" : "Turn on"}
        </button>
      )}
    </div>
  );
}
