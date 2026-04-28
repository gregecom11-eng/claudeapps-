import type { AppState } from "./types";

// Talks to /api/sync/gist on the server, which holds the GitHub PAT.
// The client never sees the token.

export async function pullSnapshot(): Promise<AppState | null> {
  const res = await fetch("/api/sync/gist");
  if (res.status === 503) return null; // Sync not configured server-side.
  if (!res.ok) throw new Error(`pull failed: ${res.status}`);
  const body = (await res.json()) as { ok: boolean; data: AppState | null };
  return body.data ?? null;
}

export async function pushSnapshot(state: AppState): Promise<void> {
  const res = await fetch("/api/sync/gist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: state }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`push failed: ${res.status} ${text.slice(0, 200)}`);
  }
}
