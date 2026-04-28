import { useCallback, useEffect, useRef, useState } from "react";
import { getAdapter } from "../lib/agent";
import { useStore } from "./useStore";

type Status = "idle" | "loading" | "ok" | "error";

export function useAgent() {
  const { state, setAgent, appendLog } = useStore();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus("loading");
    setError(null);
    try {
      const snap = await getAdapter().status();
      setAgent(snap);
      setStatus("ok");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setStatus("error");
      appendLog("dashboard", `Agent status failed: ${msg}`);
    } finally {
      inFlight.current = false;
    }
  }, [setAgent, appendLog]);

  const send = useCallback(
    async (command: string) => {
      setStatus("loading");
      setError(null);
      try {
        const snap = await getAdapter().act(command);
        setAgent(snap);
        appendLog("user", `Sent: ${command}`);
        setStatus("ok");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        setStatus("error");
        appendLog("dashboard", `Agent command failed: ${msg}`);
      }
    },
    [setAgent, appendLog],
  );

  // Polling. Re-arm whenever the configured interval changes.
  useEffect(() => {
    const sec = Math.max(15, Math.min(300, state.settings.pollIntervalSec));
    const id = window.setInterval(() => {
      refresh();
    }, sec * 1000);
    return () => window.clearInterval(id);
  }, [state.settings.pollIntervalSec, refresh]);

  return { status, error, refresh, send, snapshot: state.agent };
}
