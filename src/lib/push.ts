// Web Push subscription helper for the dashboard. Browser-side only.

import { supabase } from "./supabase";

const VAPID_CACHE_KEY = "sdl.vapid.key";

function urlBase64ToUint8Array(s: string): Uint8Array {
  const padded = s + "===".slice((s.length + 3) % 4);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function arrayBufferToB64u(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type PushState = "unsupported" | "denied" | "off" | "on";

export function pushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return "off";
  const sub = await reg.pushManager.getSubscription();
  return sub ? "on" : "off";
}

async function fetchVapidKey(): Promise<string> {
  // Cache so we don't hit the worker on every toggle.
  const cached = localStorage.getItem(VAPID_CACHE_KEY);
  if (cached) return cached;
  const res = await fetch("/api/push/vapid-public");
  if (!res.ok) {
    throw new Error(
      "Push notifications aren't configured on the server yet. Owner: visit /api/push/vapid-setup once and add the secrets to Cloudflare.",
    );
  }
  const { key } = (await res.json()) as { key: string };
  localStorage.setItem(VAPID_CACHE_KEY, key);
  return key;
}

export async function enablePush(): Promise<void> {
  if (!pushSupported()) {
    throw new Error("This browser doesn't support push notifications.");
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    throw new Error(
      perm === "denied"
        ? "Notifications were blocked. Re-enable them in your browser settings."
        : "Notification permission required.",
    );
  }

  // Make sure the service worker is registered (main.tsx registers in
  // production builds; local dev / older sessions may need a nudge).
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    reg = await navigator.serviceWorker.register(
      `${import.meta.env.BASE_URL ?? "/"}sw.js`,
    );
  }
  await navigator.serviceWorker.ready;

  const key = await fetchVapidKey();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key).buffer as ArrayBuffer,
  });

  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh ?? "";
  const auth = json.keys?.auth ?? "";
  if (!p256dh || !auth) {
    // Fallback: read raw keys.
    const p = sub.getKey("p256dh");
    const a = sub.getKey("auth");
    if (p) (json.keys as Record<string, string>).p256dh = arrayBufferToB64u(p);
    if (a) (json.keys as Record<string, string>).auth = arrayBufferToB64u(a);
  }

  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error("Not signed in");

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: json.keys,
      user_agent: navigator.userAgent,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Subscribe failed (${res.status})`);
  }
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  const session = (await supabase.auth.getSession()).data.session;
  if (session) {
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ endpoint }),
    });
  }
  await sub.unsubscribe();
}
