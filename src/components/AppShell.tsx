import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/useTheme";
import { Avatar } from "./Avatar";
import { IconButton } from "./Button";
import { Icon, type IconName } from "./Icon";

const TABS: { to: string; end?: boolean; label: string; icon: IconName }[] = [
  { to: "/", end: true, label: "Today", icon: "today" },
  { to: "/rides", label: "Rides", icon: "rides" },
  { to: "/clients", label: "Clients", icon: "clients" },
  { to: "/drivers", label: "Drivers", icon: "drivers" },
  { to: "/invoices", label: "Invoices", icon: "invoice" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

function BrandMark() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <div
        aria-hidden
        className="grid place-items-center"
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          fontFamily: "Inter",
          fontWeight: 700,
          fontSize: 13,
          color: "var(--accent)",
          letterSpacing: "0.02em",
        }}
      >
        SD
      </div>
      <div className="leading-tight">
        <div
          style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.01em" }}
        >
          SDLuxury
        </div>
        <div
          className="text-muted"
          style={{
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Operations
        </div>
      </div>
    </Link>
  );
}

function DesktopTabs() {
  return (
    <nav className="hidden md:flex items-center gap-1" aria-label="Sections">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            "inline-flex items-center gap-2 h-8 px-3 rounded-[8px] text-[13px] transition" +
            (isActive ? " font-semibold" : "")
          }
          style={({ isActive }) => ({
            color: isActive ? "var(--text)" : "var(--text-muted)",
            background: isActive ? "var(--surface-2)" : "transparent",
            border: isActive ? "1px solid var(--border)" : "1px solid transparent",
          })}
        >
          <Icon name={t.icon} size={14} />
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

function MobileTabBar() {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30"
      style={{
        background: "color-mix(in oklab, var(--bg) 85%, transparent)",
        borderTop: "1px solid var(--border)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-label="Sections"
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(${TABS.length}, 1fr)` }}>
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className="flex flex-col items-center justify-center h-14 gap-0.5"
            style={({ isActive }) => ({
              color: isActive ? "var(--accent)" : "var(--text-muted)",
            })}
          >
            {({ isActive }) => (
              <>
                <Icon name={t.icon} size={18} />
                <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 500 }}>
                  {t.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function AppShell() {
  const { profile, signOut } = useAuth();
  const [theme, setTheme] = useTheme();
  const name = profile?.full_name ?? "Account";

  return (
    <div className="min-h-full flex flex-col">
      <header
        className="sticky top-0 z-20"
        style={{
          background: "color-mix(in oklab, var(--bg) 80%, transparent)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        }}
      >
        <div className="mx-auto max-w-[1200px] px-4 md:px-6 h-14 flex items-center justify-between gap-4">
          <BrandMark />
          <DesktopTabs />
          <div className="flex items-center gap-2">
            <IconButton name="bell" label="Notifications" />
            <IconButton
              name={theme === "dark" ? "sun" : "moon"}
              label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            />
            <button
              onClick={signOut}
              title={`Sign out (${name})`}
              className="ml-1"
            >
              <Avatar name={name} size={32} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-[1200px] w-full px-4 md:px-6 py-6 md:py-8 pb-24 md:pb-12">
        <Outlet />
      </main>

      <MobileTabBar />
    </div>
  );
}
