import { ActivityFeed } from "../components/ActivityFeed";
import { AgentPanel } from "../components/AgentPanel";
import { KpiCard } from "../components/KpiCard";
import { useKpis, useStore } from "../hooks/useStore";

export function Dashboard() {
  const kpis = useKpis();
  const { state } = useStore();
  const nextEvent = [...state.events]
    .filter(
      (e) =>
        new Date(e.datetime).getTime() >= Date.now() && e.status === "scheduled",
    )
    .sort(
      (a, b) =>
        new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
    )[0];

  return (
    <div className="stack">
      <div className="kpi-grid">
        <KpiCard label="In Progress" value={kpis.inProgress} hint="tasks" />
        <KpiCard label="Planned" value={kpis.planned} hint="tasks" />
        <KpiCard label="Upcoming" value={kpis.upcoming} hint="events" />
        <KpiCard label="Completed" value={kpis.done} hint="tasks" />
      </div>

      <AgentPanel />

      <section className="card stack-sm">
        <header className="row between">
          <strong>Next event</strong>
        </header>
        {nextEvent ? (
          <div>
            <div>{nextEvent.title}</div>
            <div className="muted small">
              {new Date(nextEvent.datetime).toLocaleString()}
              {nextEvent.location ? ` · ${nextEvent.location}` : ""}
            </div>
          </div>
        ) : (
          <div className="muted">Nothing scheduled.</div>
        )}
      </section>

      <section className="card stack-sm">
        <header className="row between">
          <strong>Recent activity</strong>
        </header>
        <ActivityFeed limit={6} />
      </section>
    </div>
  );
}
