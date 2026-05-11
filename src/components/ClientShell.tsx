import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { claimClientByEmail } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/useTheme";
import type { Client } from "../lib/types";
import { Avatar } from "./Avatar";
import { IconButton } from "./Button";
import { Icon, type IconName } from "./Icon";
import { InstallBanner } from "./InstallBanner";

const TABS: { to: string; end?: boolean; label: string; icon: IconName }[] = [
  { to: "/", end: true, label: "Home", icon: "today" },
  { to: "/trips", label: "Trips", icon: "calendar" },
  { to: "/account", label: "Account", icon: "user" },
];

export type ClientShellCtx = { client: Client };

function firstName(s: string | null | undefined): string {
  if (!s) return "";
  return s.split(/\s+/)[0].replace(/[(),]/g, "");
}
function looksLikeEmail(s: string | null | undefined): boolean {
  return !!s && /\S+@\S+\.\S+/.test(s);
}

// Client shell — rider-facing chrome that mirrors the chauffeur shell:
// slim editorial top bar with serif logotype + a floating pill dock at
// the bottom for Home / Trips / Account.
//
// The shell owns the "claim client by email" handshake. If the signed-in
// user has no matching clients row, we render a soft "not on file yet"
// state instead of the tabbed app so the rider doesn't see empty trip
// lists they can't explain.
export function ClientShell() {
  const { profile, signOut, session } = useAuth();
  const [theme, setTheme] = useTheme();
  const profileName = profile?.full_name ?? null;

  const [client, setClient] = useState<Client | null | "loading">("loading");
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    claimClientByEmail()
      .then((c) => {
        if (!cancelled) setClient(c);
      })
      .catch((e) => {
        if (cancelled) return;
        setClient(null);
        setLinkError(e instanceof Error ? e.message : "Linking failed");
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Greeting prefers clients.name (set by dispatcher) over profile.full_name
  // which falls back to email at signup.
  const displayName =
    (client && client !== "loading" ? client.name : null) ??
    (looksLikeEmail(profileName) ? null : profileName) ??
    session?.user?.email ??
    "Account";
  const greeting = firstName(displayName);

  const linked = client && client !== "loading" ? client : null;

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
                border:
                  "1px solid color-mix(in oklab, var(--accent) 24%, var(--border))",
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
              <div className="eyebrow" style={{ marginTop: 3 }}>
                Concierge
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {linked && greeting ? (
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
                Hi, {greeting}
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
        {client === "loading" ? (
          <div className="text-muted">Loading…</div>
        ) : !linked ? (
          <NotOnFile email={session?.user?.email ?? null} error={linkError} />
        ) : (
          <Outlet context={{ client: linked } satisfies ClientShellCtx} />
        )}
      </main>

      {linked ? (
        <nav
          className="fixed bottom-0 left-0 right-0 z-30"
          style={{
            background: "var(--bg)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
          aria-label="Sections"
        >
          <div
            className="mx-auto max-w-[680px] px-3 pt-3 pb-2"
            style={{
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
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function NotOnFile({
  email,
  error,
}: {
  email: string | null;
  error: string | null;
}) {
  return (
    <div className="space-y-5 fade-up">
      <p className="eyebrow">Account</p>
      <h1
        className="serif"
        style={{
          fontSize: "clamp(32px, 5vw, 44px)",
          letterSpacing: "-0.015em",
          lineHeight: 1.08,
        }}
      >
        You're signed in.
      </h1>
      <div
        className="surface rounded-[14px] p-5 text-sm space-y-3"
        style={{ lineHeight: 1.6 }}
      >
        <p>
          We don't have a client account on file for this email yet. Reach
          out to Sergio so he can add you — once added, refresh this page
          and your bookings will appear.
        </p>
        {email ? (
          <code
            className="block rounded-[8px] px-3 py-2"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              fontSize: 13,
              wordBreak: "break-all",
            }}
          >
            {email}
          </code>
        ) : null}
      </div>
      {error ? <div className="text-danger text-sm">{error}</div> : null}
    </div>
  );
}
