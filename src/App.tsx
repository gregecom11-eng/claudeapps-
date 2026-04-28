import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { Dashboard } from "./views/Dashboard";
import { TaskBoard } from "./components/TaskBoard";
import { EventsList } from "./components/EventsList";
import { ActivityFeed } from "./components/ActivityFeed";
import { Settings } from "./views/Settings";
import { useStore } from "./hooks/useStore";
import { useTheme } from "./hooks/useTheme";
import { makeSeedState } from "./lib/seed";

type View = "dashboard" | "tasks" | "events" | "activity" | "settings";

export function App() {
  useTheme();
  const { state, replaceAll } = useStore();
  const [view, setView] = useState<View>("dashboard");

  // First-run nudge: if everything is empty, drop in seed data so the UI
  // is never a blank page on a fresh install.
  useEffect(() => {
    if (
      state.tasks.length === 0 &&
      state.events.length === 0 &&
      state.agentLogs.length === 0
    ) {
      replaceAll(makeSeedState());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="shell">
      <Header view={view} onChange={setView} />
      <main className="content">
        {view === "dashboard" ? <Dashboard /> : null}
        {view === "tasks" ? <TaskBoard /> : null}
        {view === "events" ? <EventsList /> : null}
        {view === "activity" ? <ActivityFeed /> : null}
        {view === "settings" ? <Settings /> : null}
      </main>
    </div>
  );
}
