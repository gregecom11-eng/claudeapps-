// Token → actor mapping for MCP / dashboard writes.
//
// Auth header (preferred):    `Authorization: Bearer <token>`
// URL path (deprecated):      `/api/mcp/<token>`  ← will be removed; emits a
//                             warning until then.
//
// Each token maps to an actor identifier (e.g. "mcp:claude") that is
// recorded on every write the request triggers (audit.actor,
// rides.updated_by, events.source).

import type { Env } from "./index";

export type AuthResult =
  | { ok: true; actor: string; viaUrl: boolean; deprecationWarning?: string }
  | { ok: false; status: 401; error: string };

// Map a token to an actor identifier by checking it against each
// configured secret. To add more callers, set a new Worker secret
// (e.g. `DASHBOARD_API_KEY`) and add a row here.
type TokenSlot = { envKey: keyof Env; actor: string };
const TOKEN_SLOTS: TokenSlot[] = [
  { envKey: "MCP_API_KEY", actor: "mcp:claude" },
  { envKey: "DASHBOARD_API_KEY", actor: "dashboard:greg" },
];

function resolveActor(env: Env, token: string | null): string | null {
  if (!token) return null;
  for (const slot of TOKEN_SLOTS) {
    const secret = env[slot.envKey] as string | undefined;
    if (secret && constantTimeEqual(token, secret)) return slot.actor;
  }
  return null;
}

// Extract token from header or URL path. Returns:
//   - { token, viaUrl: false } when the Authorization: Bearer header is set
//   - { token, viaUrl: true } when the URL still carries it
//   - { token: null, viaUrl: false } when neither is set
export function extractToken(
  request: Request,
  urlPathToken: string | null,
): { token: string | null; viaUrl: boolean } {
  const header = request.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) {
    return { token: header.slice(7).trim(), viaUrl: false };
  }
  if (urlPathToken) return { token: urlPathToken, viaUrl: true };
  return { token: null, viaUrl: false };
}

export function authenticate(
  request: Request,
  env: Env,
  urlPathToken: string | null,
): AuthResult {
  const { token, viaUrl } = extractToken(request, urlPathToken);
  if (!token) return { ok: false, status: 401, error: "missing token" };
  const actor = resolveActor(env, token);
  if (!actor) return { ok: false, status: 401, error: "invalid token" };

  if (viaUrl) {
    return {
      ok: true,
      actor,
      viaUrl: true,
      deprecationWarning:
        "URL-token auth is deprecated. Send `Authorization: Bearer <token>` instead. This path will stop accepting tokens on or after 2026-05-22.",
    };
  }
  return { ok: true, actor, viaUrl: false };
}

// Constant-time string comparison to avoid leaking secret length through
// short-circuit equality. Both args are tokens that should be the same
// length; if not, returns false but still walks the longer string so the
// comparison cost is bounded by max(len(a), len(b)).
function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
