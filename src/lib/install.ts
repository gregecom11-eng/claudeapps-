// PWA install helpers — runs in the browser only.

export type Platform =
  | "ios-safari"
  | "ios-other"
  | "android-chrome"
  | "android-other"
  | "desktop-chrome"
  | "desktop-other"
  | "unknown";

// Browsers that fire `beforeinstallprompt` capture a deferred prompt we
// can call later. We stash it on the module so the install button can
// trigger the native dialog without the user re-navigating.
type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
let deferredPrompt: DeferredPrompt | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as DeferredPrompt;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((l) => l());
  });
}

export function onInstallStateChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isChromeFamily =
    /Chrome|CriOS/.test(ua) && !/Edg|OPR/.test(ua);
  // Safari on iOS reports "Version/X" + "Safari" and lacks Chrome/Firefox tokens.
  const isIOSSafari =
    isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  if (isIOS) return isIOSSafari ? "ios-safari" : "ios-other";
  if (isAndroid) return isChromeFamily ? "android-chrome" : "android-other";
  if (isChromeFamily || /Edg/.test(ua)) return "desktop-chrome";
  return "desktop-other";
}

export function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari standalone
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((navigator as any).standalone === true) return true;
  if (
    window.matchMedia &&
    window.matchMedia("(display-mode: standalone)").matches
  )
    return true;
  return false;
}

export function canTriggerNativeInstall(): boolean {
  return deferredPrompt !== null;
}

export async function triggerNativeInstall(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  if (!deferredPrompt) return "unavailable";
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  listeners.forEach((l) => l());
  return choice.outcome;
}

// ── Visit / dismiss tracking for the smart banner ────────────────
const VISITS_KEY = "sdl.install.visits";
const DISMISS_KEY = "sdl.install.dismissed_at";

export function recordVisit(): number {
  try {
    const n = parseInt(localStorage.getItem(VISITS_KEY) ?? "0", 10) + 1;
    localStorage.setItem(VISITS_KEY, String(n));
    return n;
  } catch {
    return 0;
  }
}

export function shouldShowInstallBanner(): boolean {
  if (isInstalled()) return false;
  if (typeof window === "undefined") return false;
  // Don't bug them on the install page itself.
  if (window.location.pathname.startsWith("/install")) return false;
  try {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const ms = Date.now() - parseInt(dismissed, 10);
      // Stay quiet for 7 days after a dismissal.
      if (ms < 7 * 24 * 60 * 60 * 1000) return false;
    }
    const visits = parseInt(localStorage.getItem(VISITS_KEY) ?? "0", 10);
    return visits >= 2;
  } catch {
    return false;
  }
}

export function dismissInstallBanner(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}
