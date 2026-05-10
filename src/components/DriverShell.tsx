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
  { to: "/past", label: "Earnings", icon: "wallet" },
  { to: "/profile", label: "Profile", icon: "user" },
];

function firstName(s: string | null | undefined): string {
  if (!s) return "";
  return s.split(/\s+/)[0].replace(/[(),]/g, "");
}
function looksLikeEmail(s: string | null | undefined): boolean {
  return !!s && /\S+@\S+\.\S+/.test(s);
}

// Minimal shell for the driver app — top brand bar + bottom 4-tab nav
// (Today / Upcoming / Earnings / Profile). No admin chrome.
export function DriverShell() {
  const { profile, signOut } = useAuth();
  const [theme, setTheme] = useTheme();
  // Today screen broadcasts the driver's display name once it claims
  // the linked drivers row — that name is dispatcher-set and always
  // human, while profile.full_name silently falls back to the user's
  // email at signup (see handle_new_user trigger). Fall back to the
  // profile name only when it doesn't look like an email.
  const profileName = profile?.full_name ?? null;
  const [driverName, setDriverName] = useState<string | null>(null);
  const displayName =
    driverName ??
    (looksLikeEmail(profileName) ? null : profileName) ??
    "Driver";

  // Today screen broadcasts `sdl:driver-active-ride` when any ride on
  // its list is on_the_way / arrived / in_progress so the bottom tab
  // bar can show a status dot even after you navigate to Upcoming.
  const [activeRideRunning, setActiveRideRunning] = useState(false);
  useEffect(() => {
    const onActive = (e: Event) => {
      const detail = (e as CustomEvent<{ active: boolean }>).detail;
      setActiveRideRunning(!!detail?.active);
    };
    const onName = (e: Event) => {
      const detail = (e as CustomEvent<{ name: string | null }>).detail;
      setDriverName(detail?.name ?? null);
    };
    window.addEventListener("sdl:driver-active-ride", onActive);
    window.addEventListener("sdl:driver-name", onName);
    return () => {
      window.removeEventListener("sdl:driver-active-ride", onActive);
      window.removeEventListener("sdl:driver-name", onName);
    };
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
        <div className="mx-auto max-w-[680px] px-4 h-[68px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="grid place-items-center"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                fontWeight: 700,
                fontSize: 15,
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
                  fontSize: 16,
                  letterSpacing: "-0.01em",
                }}
              >
                SDLuxury
              </div>
              <div
                className="text-muted"
                style={{
                  fontSize: 11.5,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginTop: 1,
                }}
              >
                Driver
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {firstName(displayName) && displayName !== "Driver" ? (
              <span
                className="hidden sm:inline-flex items-center chip"
                title={`Signed in as ${displayName}`}
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  padding: "4px 12px",
                  fontSize: 13,
                }}
              >
                Hey {firstName(displayName)}
              </span>
            ) : null}
            <IconButton
              name={theme === "dark" ? "sun" : "moon"}
              label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            />
            <button
              onClick={signOut}
              title={`Sign out (${displayName})`}
              className="ml-1"
            >
              <Avatar name={displayName} size={36} />
            </button>
          </div>
        </div>
      </header>

      <InstallBanner />

      <main className="flex-1 mx-auto max-w-[680px] w-full px-4 py-6 pb-28">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-30"
        style={{
          background: "color-mix(in oklab, var(--bg) 88%, transparent)",
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
              className="flex flex-col items-center justify-center gap-1"
              style={({ isActive }) => ({
                height: 68,
                color: isActive ? "var(--accent)" : "var(--text-muted)",
                position: "relative",
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        top: 0,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 28,
                        height: 3,
                        borderRadius: "0 0 999px 999px",
                        background: "var(--accent)",
                      }}
                    />
                  ) : null}
                  <span className="relative inline-flex">
                    <Icon name={t.icon} size={22} />
                    {t.to === "/" && activeRideRunning ? (
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          top: -3,
                          right: -5,
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: "var(--accent)",
                          boxShadow: "0 0 0 2px var(--bg)",
                        }}
                      />
                    ) : null}
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: isActive ? 600 : 500,
                      letterSpacing: "-0.005em",
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
