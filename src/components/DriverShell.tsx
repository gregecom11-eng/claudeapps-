import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/useTheme";
import { Avatar } from "./Avatar";
import { IconButton } from "./Button";
import { Icon, type IconName } from "./Icon";
import { InstallBanner } from "./InstallBanner";

const TABS: { to: string; end?: boolean; label: string; icon: IconName }[] = [
  { to: "/", end: true, label: "Today", icon: "today" },
  { to: "/upcoming", label: "Upcoming", icon: "calendar" },
  { to: "/past", label: "Past", icon: "rides" },
  { to: "/profile", label: "Profile", icon: "user" },
];

function firstName(s: string | null | undefined): string {
  if (!s) return "";
  return s.split(/\s+/)[0].replace(/[(),]/g, "");
}

// Minimal shell for the driver app — top brand bar + bottom 4-tab nav
// (Today / Upcoming / Past / Profile). No admin chrome.
export function DriverShell() {
  const { profile, signOut } = useAuth();
  const [theme, setTheme] = useTheme();
  const name = profile?.full_name ?? "Driver";
  // Today screen broadcasts `sdl:driver-active-ride` when any ride on
  // its list is on_the_way / arrived / in_progress so the bottom tab
  // bar can show a status dot even after you navigate to Upcoming.
  const [activeRideRunning, setActiveRideRunning] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ active: boolean }>).detail;
      setActiveRideRunning(!!detail?.active);
    };
    window.addEventListener("sdl:driver-active-ride", handler);
    return () => window.removeEventListener("sdl:driver-active-ride", handler);
  }, []);

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
        <div className="mx-auto max-w-[680px] px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              aria-hidden
              className="grid place-items-center"
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
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
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  letterSpacing: "-0.01em",
                }}
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
                Driver
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {firstName(name) ? (
              <span
                className="hidden sm:inline-flex items-center chip"
                title={`Signed in as ${name}`}
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                }}
              >
                Hey {firstName(name)}
              </span>
            ) : null}
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

      <InstallBanner />

      <main className="flex-1 mx-auto max-w-[680px] w-full px-4 py-6 pb-24">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-30"
        style={{
          background: "color-mix(in oklab, var(--bg) 85%, transparent)",
          borderTop: "1px solid var(--border)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        aria-label="Sections"
      >
        <div
          className="grid mx-auto max-w-[680px]"
          style={{ gridTemplateColumns: `repeat(${TABS.length}, 1fr)` }}
        >
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
                  <span className="relative inline-flex">
                    <Icon name={t.icon} size={18} />
                    {t.to === "/" && activeRideRunning ? (
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          top: -2,
                          right: -4,
                          width: 7,
                          height: 7,
                          borderRadius: 999,
                          background: "var(--accent)",
                          boxShadow: "0 0 0 2px var(--bg)",
                        }}
                      />
                    ) : null}
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: isActive ? 600 : 500,
                    }}
                  >
                    {t.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
