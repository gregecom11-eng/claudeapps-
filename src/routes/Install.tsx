// Public /install page — auto-detects platform and walks the user
// through adding the dashboard to their phone in 30 seconds.

import { useEffect, useMemo, useState } from "react";
import {
  canTriggerNativeInstall,
  detectPlatform,
  isInstalled,
  onInstallStateChange,
  triggerNativeInstall,
  type Platform,
} from "../lib/install";
import { Icon } from "../components/Icon";

type ManualPlatform = "ios" | "android" | "desktop";

export function Install() {
  const detected = useMemo(detectPlatform, []);
  const [override, setOverride] = useState<ManualPlatform | null>(null);
  const [installed, setInstalled] = useState(isInstalled);
  const [native, setNative] = useState(canTriggerNativeInstall);

  useEffect(() => {
    const off = onInstallStateChange(() => {
      setInstalled(isInstalled());
      setNative(canTriggerNativeInstall());
    });
    return off;
  }, []);

  // Re-check installed-state on visibility change (helps after iOS user
  // installs to home screen and comes back to Safari).
  useEffect(() => {
    const onVis = () => setInstalled(isInstalled());
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const tab: ManualPlatform =
    override ??
    (detected.startsWith("ios")
      ? "ios"
      : detected.startsWith("android")
      ? "android"
      : "desktop");

  if (installed) {
    return <AlreadyInstalled />;
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)" }}
    >
      <header
        className="px-5 md:px-8 py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="mx-auto max-w-[760px] flex items-center gap-2.5">
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
      </header>

      <main className="flex-1 px-5 md:px-8 py-8 md:py-12 mx-auto w-full max-w-[760px]">
        <p className="eyebrow mb-3">Install on your device</p>
        <h1
          className="serif"
          style={{
            fontSize: "clamp(32px, 5vw, 44px)",
            letterSpacing: "-0.015em",
            lineHeight: 1.05,
          }}
        >
          One-time setup, takes about 30 seconds.
        </h1>
        <p
          className="text-muted mt-3"
          style={{ fontSize: 14.5, lineHeight: 1.55 }}
        >
          Once installed, SDLuxury opens like any other app from your home
          screen. You'll get notifications and the briefing screen will be
          one tap away.
        </p>

        {/* Platform tabs */}
        <div
          className="mt-7 inline-flex items-center gap-1 p-1 rounded-[10px]"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <PlatformTab
            current={tab}
            value="ios"
            label="iPhone"
            onClick={() => setOverride("ios")}
          />
          <PlatformTab
            current={tab}
            value="android"
            label="Android"
            onClick={() => setOverride("android")}
          />
          <PlatformTab
            current={tab}
            value="desktop"
            label="Desktop"
            onClick={() => setOverride("desktop")}
          />
        </div>

        {/* Native one-tap install (Chrome / Edge / Android) */}
        {native && tab !== "ios" ? (
          <div
            className="mt-6 surface rounded-[12px] p-5 flex items-center gap-4 flex-wrap"
            style={{
              background:
                "color-mix(in oklab, var(--accent) 10%, var(--surface))",
              border:
                "1px solid color-mix(in oklab, var(--accent) 35%, var(--border))",
            }}
          >
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                One-tap install available
              </div>
              <div
                className="text-muted"
                style={{ fontSize: 12.5 }}
              >
                Your browser can install SDLuxury directly. Skip the
                manual steps.
              </div>
            </div>
            <button
              onClick={async () => {
                const r = await triggerNativeInstall();
                if (r === "accepted") setInstalled(true);
              }}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-[10px] text-[14px] font-semibold"
              style={{
                background: "var(--accent)",
                color: "#15161B",
                border: "1px solid var(--accent-strong)",
              }}
            >
              <Icon name="plus" size={14} /> Install now
            </button>
          </div>
        ) : null}

        {/* Steps */}
        <div className="mt-8">
          {tab === "ios" ? <IOSSteps detected={detected} /> : null}
          {tab === "android" ? <AndroidSteps /> : null}
          {tab === "desktop" ? <DesktopSteps /> : null}
        </div>

        {/* Done */}
        <section
          className="mt-10 surface rounded-[12px] p-5"
          style={{ background: "var(--surface-2)" }}
        >
          <div className="flex items-center gap-3">
            <Icon name="check" size={18} className="text-accent" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                That's it.
              </div>
              <div
                className="text-muted"
                style={{ fontSize: 12.5 }}
              >
                Open SDLuxury from your home screen anytime. If you sign
                in once, you stay signed in.
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer
        className="text-muted text-center py-5"
        style={{ fontSize: 11.5, borderTop: "1px solid var(--border)" }}
      >
        SDLuxury Transportation, Inc.
      </footer>
    </div>
  );
}

/* ── States ─────────────────────────────────────────────────────── */
function AlreadyInstalled() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-5"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="inline-grid place-items-center"
        style={{
          width: 72,
          height: 72,
          borderRadius: 999,
          background:
            "color-mix(in oklab, var(--success) 22%, var(--surface))",
          color: "var(--success)",
          border:
            "1px solid color-mix(in oklab, var(--success) 50%, var(--border))",
        }}
      >
        <Icon name="check" size={32} />
      </div>
      <h1
        className="serif"
        style={{
          fontSize: 32,
          letterSpacing: "-0.015em",
          lineHeight: 1.1,
        }}
      >
        You're all set.
      </h1>
      <p
        className="text-muted max-w-[420px]"
        style={{ fontSize: 14.5, lineHeight: 1.55 }}
      >
        SDLuxury is installed on this device. Open it from your home
        screen — that's where the speed and notifications live.
      </p>
      <a
        href="/"
        className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-[10px] text-[14px] font-semibold"
        style={{
          background: "var(--accent)",
          color: "#15161B",
          border: "1px solid var(--accent-strong)",
        }}
      >
        Open the app <Icon name="arrow" size={14} />
      </a>
    </div>
  );
}

function PlatformTab({
  current,
  value,
  label,
  onClick,
}: {
  current: ManualPlatform;
  value: ManualPlatform;
  label: string;
  onClick: () => void;
}) {
  const active = current === value;
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center h-9 px-4 rounded-[8px] text-[13px] font-medium transition"
      style={{
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--text)" : "var(--text-muted)",
        border: active ? "1px solid var(--border)" : "1px solid transparent",
        fontWeight: active ? 600 : 500,
      }}
    >
      {label}
    </button>
  );
}

/* ── Steps per platform ─────────────────────────────────────────── */
function Step({
  n,
  title,
  body,
  glyph,
}: {
  n: number;
  title: string;
  body: React.ReactNode;
  glyph?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 py-4">
      <div
        className="inline-grid place-items-center shrink-0 tabular"
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>
          {title}
        </div>
        <div
          className="text-muted mt-1"
          style={{ fontSize: 14, lineHeight: 1.55 }}
        >
          {body}
        </div>
        {glyph ? (
          <div className="mt-3 flex items-center gap-2">{glyph}</div>
        ) : null}
      </div>
    </div>
  );
}

function StepDivider() {
  return (
    <div
      style={{ height: 1, background: "var(--border)", marginLeft: 48 }}
    />
  );
}

function GlyphCard({
  children,
  caption,
}: {
  children: React.ReactNode;
  caption?: string;
}) {
  return (
    <div
      className="rounded-[10px] px-4 py-3 inline-flex items-center gap-2.5"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {children}
      {caption ? (
        <span
          className="text-muted"
          style={{ fontSize: 13 }}
        >
          {caption}
        </span>
      ) : null}
    </div>
  );
}

/* iOS Share icon — square with up arrow, like Apple's */
function IOSShareGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--accent)" }}
    >
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

/* Generic three-dots / kebab menu */
function MenuGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ color: "var(--accent)" }}
    >
      <circle cx="12" cy="6" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="18" r="1.6" />
    </svg>
  );
}

/* "Plus" tile that mimics the iOS Add to Home Screen line */
function PlusTileGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      style={{ color: "var(--accent)" }}
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function IOSSteps({ detected }: { detected: Platform }) {
  return (
    <div>
      {detected === "ios-other" ? (
        <div
          className="rounded-[10px] p-4 mb-5"
          style={{
            background:
              "color-mix(in oklab, var(--warn) 10%, var(--surface))",
            border:
              "1px solid color-mix(in oklab, var(--warn) 35%, var(--border))",
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          <strong>Open this page in Safari.</strong> On iPhone, only
          Safari can install apps to the home screen — Chrome and Firefox
          can't. Long-press the link, copy it, then paste it into Safari.
        </div>
      ) : null}
      <Step
        n={1}
        title="Tap the Share button"
        body={
          <>It's at the bottom of Safari (or top, on older iPhones).</>
        }
        glyph={
          <GlyphCard caption="Share">
            <IOSShareGlyph />
          </GlyphCard>
        }
      />
      <StepDivider />
      <Step
        n={2}
        title="Scroll to “Add to Home Screen”"
        body={
          <>
            Swipe down through the share menu until you see this option.
            Tap it.
          </>
        }
        glyph={
          <GlyphCard caption="Add to Home Screen">
            <PlusTileGlyph />
          </GlyphCard>
        }
      />
      <StepDivider />
      <Step
        n={3}
        title="Tap “Add”"
        body={
          <>
            Top-right corner. SDLuxury appears on your home screen with
            its own icon.
          </>
        }
      />
    </div>
  );
}

function AndroidSteps() {
  return (
    <div>
      <Step
        n={1}
        title="Tap the menu (⋮)"
        body={<>Top-right of Chrome. Three dots stacked vertically.</>}
        glyph={
          <GlyphCard caption="Menu">
            <MenuGlyph />
          </GlyphCard>
        }
      />
      <StepDivider />
      <Step
        n={2}
        title="Tap “Install app”"
        body={
          <>
            (Or "Add to Home screen" on older versions of Chrome — same
            thing.)
          </>
        }
        glyph={
          <GlyphCard caption="Install app">
            <PlusTileGlyph />
          </GlyphCard>
        }
      />
      <StepDivider />
      <Step
        n={3}
        title="Confirm “Install”"
        body={
          <>
            Chrome adds SDLuxury to your home screen and your app
            drawer.
          </>
        }
      />
    </div>
  );
}

function DesktopSteps() {
  return (
    <div>
      <Step
        n={1}
        title="Look in the address bar"
        body={
          <>
            Chrome and Edge show a small install icon on the right side of
            the URL bar (a monitor with a down-arrow).
          </>
        }
      />
      <StepDivider />
      <Step
        n={2}
        title="Click it, then “Install”"
        body={
          <>
            Or use the menu: ⋮ → Install SDLuxury. The dashboard opens in
            its own window like any other app.
          </>
        }
      />
    </div>
  );
}
