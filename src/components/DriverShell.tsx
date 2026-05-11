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

// Driver shell — chauffeur-grade chrome:
//  • Slim, generous top bar with serif logotype and "Hey ___" greeting.
//  • Bottom nav uses a pill rest with the active tab lifted on a chip,
//    so the dock feels like furniture rather than a strip of links.
export function DriverShell() {
  const { profile, signOut } = useAuth();
  const [theme, setTheme] = useTheme();
  const profileName = profile?.full_name ?? null;
  const [driverName, setDriverName] = useState<string | null>(null);
  const displayName =
    driverName ??
    (looksLikeEmail(profileName) ? null : profileName) ??
    "Driver";

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

  const greeting = firstName(displayName);

  return (
    <div className="min-h-full flex flex-col">
      <header
        className="sticky top-0 z-20"
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in oklab, var(--bg) 92%, transparent) 0%, color-mix(in oklab, var(--bg) 75%, transparent) 100%)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        }}
      >
        <div className="mx-auto max-w-[680px] px-5 h-[72px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              aria-hidden
              className="grid place-items-center shrink-0"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background:
                  "linear-gradient(135deg, color-mix(in oklab, var(--accent) 18%, var(--surface-2)), var(--surface-2))",
                border: "1px solid color-mix(in oklab, var(--accent) 24%, var(--border))",
                color: "var(--accent)",
                fontWeight: 600,
                fontSize: 17,
                letterSpacing: "-0.01em",
                fontFamily: "'Cormorant Garamond', Georgia, serif",
              }}
            >
              SD
            </div>
            <div className="leading-tight min-w-0">
              <div
                className="serif"
                style={{
                  fontSize: 19,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.1,
                }}
              >
                SDLuxury
              </div>
              <div
                className="eyebrow"
                style={{ marginTop: 3 }}
              >
                Chauffeur
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {greeting && displayName !== "Driver" ? (
              <span
                className="hidden sm:inline-flex items-center chip"
                title={`Signed in as ${displayName}`}
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  fontWeight: 500,
                  letterSpacing: "-0.005em",
                  padding: "5px 12px",
                  fontSize: 13,
                }}
              >
                Hey {greeting}
              </span>
            ) : null}
            <IconButton
              name={theme === "dark" ? "sun" : "moon"}
              label="Toggle theme"
              size="md"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            />
            <button
              onClick={signOut}
              title={`Sign out (${displayName})`}
              className="ml-1 transition active:scale-[0.96]"
            >
              <Avatar name={displayName} size={40} shape="rounded" />
            </button>
          </div>
        </div>
      </header>

      <InstallBanner />

      <main className="flex-1 mx-auto max-w-[680px] w-full px-5 py-7 pb-32">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-30"
        style={{
          // Solid through the iOS home-indicator band so the dock can
          // never show page content underneath.
          background: "var(--bg)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        aria-label="Sections"
      >
        <div
          className="mx-auto max-w-[680px] px-3 pt-3 pb-2"
          style={{
            // Solid surface so content scrolls under cleanly instead of
            // bleeding through a translucent strip.
            background: "var(--bg)",
            boxShadow:
              "0 -12px 16px -12px color-mix(in oklab, var(--bg) 85%, transparent)",
          }}
        >
          <div
            className="mx-auto"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 22,
              boxShadow: "var(--shadow-md)",
              padding: 4,
            }}
          >
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${TABS.length}, 1fr)` }}
            >
              {TABS.map((t) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.end}
                  className="flex flex-col items-center justify-center gap-1 transition select-none active:scale-[0.97]"
                  style={({ isActive }) => ({
                    height: 60,
                    borderRadius: 18,
                    color: isActive ? "#15161B" : "var(--text-muted)",
                    background: isActive ? "var(--accent)" : "transparent",
                    boxShadow: isActive
                      ? "0 4px 14px color-mix(in oklab, var(--accent) 40%, transparent)"
                      : "none",
                    fontWeight: isActive ? 600 : 500,
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <span className="relative inline-flex">
                        <Icon name={t.icon} size={20} />
                        {t.to === "/" && activeRideRunning && !isActive ? (
                          <span
                            aria-hidden
                            style={{
                              position: "absolute",
                              top: -3,
                              right: -4,
                              width: 8,
                              height: 8,
                              borderRadius: 999,
                              background: "var(--accent)",
                              boxShadow: "0 0 0 2px var(--surface)",
                            }}
                          />
                        ) : null}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          letterSpacing: "-0.005em",
                          lineHeight: 1,
                        }}
                      >
                        {t.label}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
