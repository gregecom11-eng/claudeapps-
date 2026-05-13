import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/useTheme";
import { Avatar } from "./Avatar";
import { IconButton } from "./Button";
import { Icon, type IconName } from "./Icon";
import { InstallBanner } from "./InstallBanner";

type Tab = { to: string; end?: boolean; label: string; icon: IconName };

// Desktop nav shows every tab horizontally. Mobile keeps the 4 most
// frequently-used in the dock (Today / Rides / Calendar / Earnings)
// and tucks Clients / Drivers / Settings behind a More sheet so the
// dock doesn't feel like a control panel cockpit on a 375px screen.
const DESKTOP_TABS: Tab[] = [
  { to: "/", end: true, label: "Today", icon: "today" },
  { to: "/rides", label: "Rides", icon: "rides" },
  { to: "/calendar", label: "Calendar", icon: "calendar" },
  { to: "/clients", label: "Clients", icon: "clients" },
  { to: "/drivers", label: "Drivers", icon: "drivers" },
  { to: "/earnings", label: "Earnings", icon: "wallet" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

const MOBILE_DOCK: Tab[] = [
  { to: "/", end: true, label: "Today", icon: "today" },
  { to: "/rides", label: "Rides", icon: "rides" },
  { to: "/calendar", label: "Schedule", icon: "calendar" },
  { to: "/earnings", label: "Earnings", icon: "wallet" },
];

const MORE_LINKS: Tab[] = [
  { to: "/clients", label: "Clients", icon: "clients" },
  { to: "/drivers", label: "Drivers", icon: "drivers" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

function firstName(s: string | null | undefined): string {
  if (!s) return "";
  return s.split(/\s+/)[0].replace(/[(),]/g, "");
}
function looksLikeEmail(s: string | null | undefined): boolean {
  return !!s && /\S+@\S+\.\S+/.test(s);
}

function BrandMark() {
  return (
    <Link to="/" className="flex items-center gap-3 min-w-0 transition active:scale-[0.98]">
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
            fontWeight: 600,
            fontSize: 19,
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
          }}
        >
          SDLuxury
        </div>
        <div className="eyebrow" style={{ marginTop: 3 }}>
          Operations
        </div>
      </div>
    </Link>
  );
}

function DesktopTabs() {
  return (
    <nav className="hidden md:flex items-center gap-1" aria-label="Sections">
      {DESKTOP_TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            "inline-flex items-center gap-2 h-9 px-3 rounded-[10px] text-[13px] transition" +
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

function MobileDock({
  onMore,
  moreActive,
}: {
  onMore: () => void;
  moreActive: boolean;
}) {
  const total = MOBILE_DOCK.length + 1; // +1 for the "More" slot
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30"
      style={{
        // Solid all the way through (including the iOS home-indicator
        // safe-area band) so nothing from the page scroll shows under
        // the dock.
        background: "var(--bg)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-label="Sections"
    >
      <div
        className="mx-auto max-w-[680px] px-3 pt-3 pb-2"
        style={{
          // Solid background so content scrolling underneath stops
          // cleanly before reaching the dock instead of bleeding through
          // a translucent strip.
          background: "var(--bg)",
          // Quick fade just above the solid band, so the page doesn't
          // visibly "cut off" at a hard edge — the fade lives entirely
          // above the dock and adds <12px of soft transition.
          boxShadow:
            "0 -12px 16px -12px color-mix(in oklab, var(--bg) 85%, transparent)",
        }}
      >
        <div
          className="mx-auto"
          style={{
            // Solid pill so nothing shows through it either. The
            // floating shadow keeps the "lifted" feel.
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 22,
            boxShadow: "var(--shadow-md)",
            padding: 4,
          }}
        >
          <div className="grid" style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}>
            {MOBILE_DOCK.map((t) => (
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
                {() => (
                  <>
                    <Icon name={t.icon} size={20} />
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
                {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
              </NavLink>
            ))}
            <button
              onClick={onMore}
              className="flex flex-col items-center justify-center gap-1 transition select-none active:scale-[0.97]"
              style={{
                height: 60,
                borderRadius: 18,
                color: moreActive ? "#15161B" : "var(--text-muted)",
                background: moreActive ? "var(--accent)" : "transparent",
                boxShadow: moreActive
                  ? "0 4px 14px color-mix(in oklab, var(--accent) 40%, transparent)"
                  : "none",
                fontWeight: moreActive ? 600 : 500,
                border: 0,
              }}
              aria-haspopup="dialog"
              aria-expanded={moreActive}
            >
              <Icon name="menu" size={20} />
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: "-0.005em",
                  lineHeight: 1,
                }}
              >
                More
              </span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function MoreSheet({
  open,
  onClose,
  name,
  email,
  onSignOut,
  theme,
  setTheme,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  email: string;
  onSignOut: () => void;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  // Close the sheet on every route change (e.g. when the user taps a
  // link inside it) so it doesn't stay mounted between screens.
  useEffect(() => {
    if (!open) return;
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Esc to close, scroll-lock the page underneath.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const go = (to: string) => {
    navigate(to);
    onClose();
  };

  return (
    <div
      className="md:hidden fixed inset-0 z-40 flex items-end justify-center"
      style={{ background: "color-mix(in oklab, #000 62%, transparent)" }}
      onClick={onClose}
    >
      <div
        className="w-full fade-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 680,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderBottom: "none",
          borderRadius: "20px 20px 0 0",
          boxShadow: "var(--shadow-lg)",
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        {/* Drag handle */}
        <div
          aria-hidden
          className="flex justify-center pt-2.5 pb-1"
        >
          <div
            style={{
              width: 44,
              height: 4,
              borderRadius: 999,
              background: "var(--border-strong)",
            }}
          />
        </div>

        {/* Identity */}
        <div
          className="px-5 pt-3 pb-5 flex items-center gap-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <Avatar name={name} size={48} shape="rounded" />
          <div className="min-w-0 flex-1">
            <div className="eyebrow" style={{ fontSize: 10 }}>
              Signed in
            </div>
            <div
              className="serif truncate mt-0.5"
              style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}
            >
              {name}
            </div>
            <div
              className="text-muted truncate"
              style={{ fontSize: 12, marginTop: 1 }}
            >
              {email}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-grid place-items-center transition active:scale-[0.94]"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              background: "var(--surface-2)",
            }}
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Section links */}
        <div className="px-3 pt-3">
          <div
            className="eyebrow px-2 mb-2"
            style={{ fontSize: 10.5 }}
          >
            Workspace
          </div>
          <ul className="space-y-1">
            {MORE_LINKS.map((t) => (
              <li key={t.to}>
                <button
                  onClick={() => go(t.to)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-[12px] transition active:scale-[0.995]"
                  style={{
                    background: "transparent",
                    color: "var(--text)",
                    textAlign: "left",
                  }}
                >
                  <span
                    className="inline-grid place-items-center"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--text-muted)",
                    }}
                  >
                    <Icon name={t.icon} size={15} />
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>
                    {t.label}
                  </span>
                  <span className="flex-1" />
                  <Icon
                    name="chev"
                    size={14}
                    className="text-muted"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick actions */}
        <div className="px-3 pt-4">
          <div
            className="eyebrow px-2 mb-2"
            style={{ fontSize: 10.5 }}
          >
            Quick actions
          </div>
          <div className="grid grid-cols-2 gap-2 px-1">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex items-center gap-2 px-3 py-3 rounded-[12px] transition active:scale-[0.97]"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                fontSize: 13.5,
                fontWeight: 500,
              }}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <button
              onClick={onSignOut}
              className="flex items-center gap-2 px-3 py-3 rounded-[12px] transition active:scale-[0.97]"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--danger)",
                fontSize: 13.5,
                fontWeight: 500,
              }}
            >
              <Icon name="back" size={15} />
              Sign out
            </button>
          </div>
        </div>

        <div className="h-3" />
      </div>
    </div>
  );
}

export function AppShell() {
  const { profile, session, signOut } = useAuth();
  const [theme, setTheme] = useTheme();
  const profileName = profile?.full_name ?? null;
  const displayName =
    (looksLikeEmail(profileName) ? null : profileName) ?? "Account";
  const greeting = firstName(displayName);
  const email = session?.user?.email ?? "";

  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  // Light up the "More" tab when the active route is one of its children.
  const moreActive = MORE_LINKS.some((t) =>
    location.pathname === t.to ||
    (t.to !== "/" && location.pathname.startsWith(t.to + "/")),
  );
  // Routes where the page renders its own sticky bottom bar (the RideForm
  // has a Save bar). The mobile dock would otherwise cover that bar.
  const isFocusedTask =
    location.pathname === "/rides/new" ||
    /^\/rides\/[^/]+\/edit$/.test(location.pathname);

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
        <div className="mx-auto max-w-[1200px] px-5 md:px-6 h-[72px] flex items-center justify-between gap-4">
          <BrandMark />
          <DesktopTabs />
          <div className="flex items-center gap-2">
            {greeting && displayName !== "Account" ? (
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

      <main className="flex-1 mx-auto max-w-[1200px] w-full px-5 md:px-6 py-6 md:py-8 pb-32 md:pb-12">
        <Outlet />
      </main>

      {/* The ride form has its own sticky save bar pinned to the bottom.
          Showing the dock on top of that would hide the Save buttons,
          which is exactly what was happening on phones. Drop the dock
          while the form is the active task. */}
      {isFocusedTask ? null : (
        <MobileDock
          onMore={() => setMoreOpen(true)}
          moreActive={moreActive}
        />
      )}
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        name={displayName}
        email={email}
        onSignOut={signOut}
        theme={theme}
        setTheme={setTheme}
      />
    </div>
  );
}
