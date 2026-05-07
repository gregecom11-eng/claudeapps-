import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  canTriggerNativeInstall,
  detectPlatform,
  dismissInstallBanner,
  isInstalled,
  onInstallStateChange,
  recordVisit,
  shouldShowInstallBanner,
  triggerNativeInstall,
} from "../lib/install";
import { Icon } from "./Icon";

// Slim banner that appears at the top of the AppShell once a user has
// visited a couple of times and isn't running as a PWA. Quiet for 7 days
// after dismissal.
export function InstallBanner() {
  const [show, setShow] = useState(false);
  const [native, setNative] = useState(false);

  useEffect(() => {
    recordVisit();
    setShow(shouldShowInstallBanner());
    setNative(canTriggerNativeInstall());
    const off = onInstallStateChange(() => {
      setNative(canTriggerNativeInstall());
      if (isInstalled()) setShow(false);
    });
    return off;
  }, []);

  if (!show) return null;

  const platform = detectPlatform();
  const friendly =
    platform.startsWith("ios")
      ? "iPhone"
      : platform.startsWith("android")
      ? "Android"
      : "this computer";

  const onInstall = async () => {
    if (canTriggerNativeInstall()) {
      const r = await triggerNativeInstall();
      if (r === "accepted") setShow(false);
      return;
    }
    // Fall through: take them to /install for guided steps.
    window.location.href = "/install";
  };

  const onDismiss = () => {
    dismissInstallBanner();
    setShow(false);
  };

  return (
    <div
      className="px-3 py-2 flex items-center gap-3 flex-wrap"
      style={{
        background:
          "color-mix(in oklab, var(--accent) 12%, var(--surface))",
        borderBottom:
          "1px solid color-mix(in oklab, var(--accent) 35%, var(--border))",
      }}
    >
      <Icon
        name="plus"
        size={14}
        className="text-accent shrink-0"
      />
      <div className="flex-1 min-w-0">
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          Install SDLuxury on {friendly}
        </span>
        <span
          className="text-muted ml-2"
          style={{ fontSize: 12 }}
        >
          One-time, ~30 seconds. Faster + push notifications.
        </span>
      </div>
      {native ? (
        <button
          onClick={onInstall}
          className="inline-flex items-center justify-center h-8 px-3 rounded-[8px] text-[12.5px] font-semibold"
          style={{
            background: "var(--accent)",
            color: "#15161B",
            border: "1px solid var(--accent-strong)",
          }}
        >
          Install
        </button>
      ) : (
        <Link
          to="/install"
          className="inline-flex items-center gap-1 h-8 px-3 rounded-[8px] text-[12.5px] font-semibold"
          style={{
            background: "var(--accent)",
            color: "#15161B",
            border: "1px solid var(--accent-strong)",
          }}
        >
          Show me how <Icon name="arrow" size={12} />
        </Link>
      )}
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="inline-grid place-items-center"
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          border: "1px solid var(--border)",
          color: "var(--text-muted)",
          background: "transparent",
        }}
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}
