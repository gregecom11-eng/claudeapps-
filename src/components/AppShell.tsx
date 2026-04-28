import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";

const NAV = [
  { to: "/", label: "Today", end: true },
  { to: "/rides", label: "Rides" },
  { to: "/clients", label: "Clients" },
  { to: "/drivers", label: "Drivers" },
  { to: "/invoices", label: "Invoices" },
  { to: "/settings", label: "Settings" },
];

export function AppShell() {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-accent" />
            <span className="font-semibold tracking-tight">SDLuxury Ops</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted hidden sm:inline">
              {profile?.full_name ?? profile?.role ?? ""}
            </span>
            <button onClick={signOut} className="btn btn-ghost text-xs">
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto max-w-6xl px-2 pb-2 flex gap-1 overflow-x-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                [
                  "px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition",
                  isActive
                    ? "bg-surface-2 text-text"
                    : "text-muted hover:text-text",
                ].join(" ")
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-6 pb-[max(env(safe-area-inset-bottom),16px)]">
        <Outlet />
      </main>
    </div>
  );
}
