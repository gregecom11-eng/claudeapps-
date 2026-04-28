import { useRef, useState } from "react";
import { useStore } from "../hooks/useStore";
import { downloadBackup, importJson } from "../lib/storage";
import { pullSnapshot, pushSnapshot } from "../lib/gist";
import { makeSeedState } from "../lib/seed";

export function Settings() {
  const { state, updateSettings, replaceAll, appendLog } = useStore();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const next = importJson(text);
      replaceAll(next);
      setMsg("Imported backup.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Import failed");
    }
  };

  const cloudPull = async () => {
    setBusy("pull");
    setMsg(null);
    try {
      const snap = await pullSnapshot();
      if (!snap) {
        setMsg("Sync not configured or empty.");
      } else {
        replaceAll(snap);
        appendLog("sync", "Pulled snapshot from gist");
        setMsg("Pulled.");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Pull failed");
    } finally {
      setBusy(null);
    }
  };

  const cloudPush = async () => {
    setBusy("push");
    setMsg(null);
    try {
      await pushSnapshot(state);
      appendLog("sync", "Pushed snapshot to gist");
      setMsg("Pushed.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Push failed");
    } finally {
      setBusy(null);
    }
  };

  const seed = () => {
    if (!confirm("Replace current data with sample seed data?")) return;
    replaceAll(makeSeedState());
    setMsg("Loaded seed data.");
  };

  return (
    <div className="stack">
      <section className="card stack-sm">
        <strong>Polling</strong>
        <label className="row gap-sm">
          <span className="grow">Refresh interval (seconds)</span>
          <input
            className="input"
            style={{ width: 96 }}
            type="number"
            min={15}
            max={300}
            value={state.settings.pollIntervalSec}
            onChange={(e) =>
              updateSettings({
                pollIntervalSec: Math.max(15, Math.min(300, Number(e.target.value) || 30)),
              })
            }
          />
        </label>
      </section>

      <section className="card stack-sm">
        <strong>Backup</strong>
        <div className="row gap-sm wrap">
          <button className="btn" onClick={() => downloadBackup(state)}>
            Export JSON
          </button>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
            Import JSON…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = "";
            }}
          />
          <button className="btn-ghost" onClick={seed}>
            Load seed data
          </button>
        </div>
      </section>

      <section className="card stack-sm">
        <strong>Cloud sync (private gist)</strong>
        <div className="muted small">
          Server proxies the GitHub PAT — the browser never sees it. Configure
          <code> GITHUB_GIST_TOKEN</code> on Cloudflare Pages to enable.
        </div>
        <div className="row gap-sm wrap">
          <button className="btn" onClick={cloudPush} disabled={busy !== null}>
            {busy === "push" ? "Pushing…" : "Push now"}
          </button>
          <button className="btn-ghost" onClick={cloudPull} disabled={busy !== null}>
            {busy === "pull" ? "Pulling…" : "Pull now"}
          </button>
        </div>
      </section>

      {msg ? <div className="muted small">{msg}</div> : null}
    </div>
  );
}
