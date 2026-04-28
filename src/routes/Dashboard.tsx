import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listEvents, listRides } from "../lib/api";
import { fmtMoney, fmtTime, relTime } from "../lib/format";
import { StatusBadge } from "../components/StatusBadge";
import type { ActivityEvent, Ride } from "../lib/types";

function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function Dashboard() {
  const [todayRides, setTodayRides] = useState<Ride[] | null>(null);
  const [tomorrowFirst, setTomorrowFirst] = useState<Ride | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const today = await listRides({
          from: startOfDay().toISOString(),
          to: endOfDay().toISOString(),
        });
        const tomorrowStart = startOfDay(
          new Date(Date.now() + 24 * 60 * 60 * 1000),
        );
        const tomorrow = await listRides({
          from: tomorrowStart.toISOString(),
          to: endOfDay(tomorrowStart).toISOString(),
          limit: 1,
        });
        const evs = await listEvents(8);
        if (cancelled) return;
        setTodayRides(today);
        setTomorrowFirst(tomorrow[0] ?? null);
        setEvents(evs);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = useMemo(() => {
    const list = todayRides ?? [];
    return {
      total: list.length,
      inProgress: list.filter((r) => r.status === "in_progress").length,
      revenueCents: list
        .filter((r) => r.status !== "cancelled")
        .reduce((s, r) => s + r.total_cents, 0),
      tomorrow: tomorrowFirst,
    };
  }, [todayRides, tomorrowFirst]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Today</h1>
        <Link to="/rides/new" className="btn btn-primary">
          + New ride
        </Link>
      </div>

      {error ? (
        <div className="card text-sm text-danger">{error}</div>
      ) : null}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Today's rides" value={kpis.total} />
        <Kpi label="In progress" value={kpis.inProgress} />
        <Kpi label="Today's revenue" value={fmtMoney(kpis.revenueCents)} />
        <Kpi
          label="Tomorrow's first"
          value={kpis.tomorrow ? fmtTime(kpis.tomorrow.pickup_at) : "—"}
          hint={kpis.tomorrow?.passenger_name ?? undefined}
        />
      </section>

      <section className="card space-y-3">
        <header className="flex items-center justify-between">
          <h2 className="font-medium">Today's schedule</h2>
          {todayRides ? (
            <span className="text-xs text-muted">
              {todayRides.length} {todayRides.length === 1 ? "ride" : "rides"}
            </span>
          ) : null}
        </header>
        {todayRides === null ? (
          <div className="text-muted text-sm">Loading…</div>
        ) : todayRides.length === 0 ? (
          <div className="text-muted text-sm">
            Nothing on the books for today. Use + New ride or have your Claude
            agent create one.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {todayRides.map((r) => (
              <li key={r.id} className="py-3 flex items-center gap-3">
                <div className="tabular text-sm font-medium w-16">
                  {fmtTime(r.pickup_at)}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/rides/${r.id}`}
                    className="block font-medium truncate hover:underline"
                  >
                    {r.passenger_name}
                  </Link>
                  <div className="text-xs text-muted truncate">
                    {r.pickup_address}
                    {r.dropoff_address ? ` → ${r.dropoff_address}` : ""}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">Recent activity</h2>
        {events.length === 0 ? (
          <div className="text-muted text-sm">No activity yet.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <span className="badge">{e.source}</span>
                <span className="flex-1 truncate">{e.message}</span>
                <span className="text-xs text-muted tabular">
                  {relTime(e.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="card space-y-1">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-xl font-semibold tabular">{value}</div>
      {hint ? <div className="text-xs text-muted truncate">{hint}</div> : null}
    </div>
  );
}
