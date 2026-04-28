import { useState } from "react";
import { useAgent } from "../hooks/useAgent";
import { useStore } from "../hooks/useStore";

export function AgentPanel() {
  const { snapshot, status, error, refresh, send } = useAgent();
  const { state } = useStore();
  const [draft, setDraft] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = draft.trim();
    if (!cmd) return;
    setDraft("");
    await send(cmd);
  };

  return (
    <section className="card stack-sm">
      <header className="row between">
        <div className="row gap-sm">
          <strong>Agent</strong>
          <span className={`dot dot-${status}`} aria-label={status} />
        </div>
        <button
          className="btn-ghost"
          onClick={refresh}
          disabled={status === "loading"}
        >
          {status === "loading" ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {error ? <div className="muted small error">{error}</div> : null}

      {snapshot ? (
        <>
          <div className="agent-summary">{snapshot.summary || "—"}</div>
          <div className="muted small">
            Step: {snapshot.currentStep || "—"} · Confidence:{" "}
            {Math.round((snapshot.confidence ?? 0) * 100)}%
          </div>
          {snapshot.todos.length > 0 ? (
            <ul className="stack-sm">
              {snapshot.todos.slice(0, 5).map((t, i) => (
                <li key={i} className="small">
                  <span className={`badge ${t.status}`}>{t.status}</span>{" "}
                  {t.title}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="muted small">
            Last refresh: {new Date(snapshot.fetchedAt).toLocaleTimeString()}
          </div>
        </>
      ) : (
        <div className="muted small">
          No agent data yet. Press refresh, or set
          <code> OPENAI_API_KEY</code> on the server.
        </div>
      )}

      <form className="row gap-sm" onSubmit={onSubmit}>
        <input
          className="input grow"
          placeholder={`Send a command (poll: ${state.settings.pollIntervalSec}s)`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
        />
        <button className="btn" type="submit" disabled={status === "loading"}>
          Send
        </button>
      </form>
    </section>
  );
}
