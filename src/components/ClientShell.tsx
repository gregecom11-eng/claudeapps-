import { Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/useTheme";
import { Avatar } from "./Avatar";
import { IconButton } from "./Button";

// Editorial-style shell for client-facing portal.
// Single page (no nav tabs); just brand bar + sign out.
export function ClientShell() {
  const { profile, signOut, session } = useAuth();
  const [theme, setTheme] = useTheme();
  const name = profile?.full_name ?? session?.user?.email ?? "Account";

  return (
    <div className="min-h-full flex flex-col">
      <header
        className="sticky top-0 z-20"
        style={{
          background: "color-mix(in oklab, var(--bg) 80%, transparent)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div className="mx-auto max-w-[920px] px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              aria-hidden
              className="grid place-items-center"
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                fontWeight: 700,
                fontSize: 13,
                color: "var(--accent)",
              }}
            >
              SD
            </div>
            <span
              className="serif"
              style={{ fontSize: 20, letterSpacing: "-0.01em" }}
            >
              SDLuxury
            </span>
          </div>
          <div className="flex items-center gap-2">
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

      <main className="flex-1 mx-auto max-w-[920px] w-full px-5 md:px-8 py-8 md:py-12">
        <Outlet />
      </main>

      <footer
        className="text-muted text-center py-6"
        style={{ fontSize: 11.5, borderTop: "1px solid var(--border)" }}
      >
        SDLuxury Transportation, Inc. · For your concierge needs, reply
        to your latest confirmation.
      </footer>
    </div>
  );
}
