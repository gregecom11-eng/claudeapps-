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
      className="mx-auto max-w-[680px] mt-3 mx-5"
      style={{
        margin: "12px 20px 0",
      }}
    >
      <div
        className="flex items-center gap-3 rounded-[14px] px-4 py-3"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--accent) 18%, var(--surface)) 0%, var(--surface) 80%)",
          border: "1px solid color-mix(in oklab, var(--accent) 30%, var(--border))",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <span
          className="inline-grid place-items-center shrink-0"
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: "color-mix(in oklab, var(--accent) 18%, var(--surface))",
            border: "1px solid color-mix(in oklab, var(--accent) 30%, var(--border))",
            color: "var(--accent)",
          }}
        >
          <Icon name="plus" size={14} />
        </span>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.25 }}>
            Add SDLuxury to your {friendly}
          </div>
          <div
            className="text-muted"
            style={{ fontSize: 12, marginTop: 2, lineHeight: 1.4 }}
          >
            Opens in a tap. Push notifications. No app store.
          </div>
        </div>
        {native ? (
          <button
            onClick={onInstall}
            className="inline-flex items-center justify-center h-9 px-3.5 rounded-[10px] text-[12.5px] font-semibold transition active:scale-[0.97] shrink-0"
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
            className="inline-flex items-center gap-1 h-9 px-3.5 rounded-[10px] text-[12.5px] font-semibold transition active:scale-[0.97] shrink-0"
            style={{
              background: "var(--accent)",
              color: "#15161B",
              border: "1px solid var(--accent-strong)",
            }}
          >
            How <Icon name="arrow" size={12} />
          </Link>
        )}
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="inline-grid place-items-center shrink-0 transition active:scale-[0.94]"
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
            background: "transparent",
          }}
        >
          <Icon name="x" size={13} />
        </button>
      </div>
    </div>
  );
}
