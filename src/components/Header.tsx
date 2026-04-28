import { useStore } from "../hooks/useStore";

type View = "dashboard" | "tasks" | "events" | "activity" | "settings";

const TABS: { key: View; label: string }[] = [
  { key: "dashboard", label: "Home" },
  { key: "tasks", label: "Tasks" },
  { key: "events", label: "Events" },
  { key: "activity", label: "Activity" },
  { key: "settings", label: "Settings" },
];

export function Header({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  const { state, updateSettings } = useStore();
  const theme = state.settings.theme;

  const cycleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    updateSettings({ theme: next });
  };

  return (
    <header className="appbar">
      <div className="appbar-row">
        <div className="brand">Limo · Agent</div>
        <button
          className="btn-ghost"
          onClick={cycleTheme}
          title={`Theme: ${theme}`}
          aria-label="Toggle theme"
        >
          {theme === "light" ? "☀" : theme === "dark" ? "☾" : "◐"}
        </button>
      </div>
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={view === t.key}
            className={`tab ${view === t.key ? "active" : ""}`}
            onClick={() => onChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
