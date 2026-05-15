// Per-actor rate limiter backed by `mcp_rate_limits` + the
// `check_and_increment_rate_limit` RPC in Postgres. One round-trip
// upserts the current-minute counter, sums the last hour, returns
// the verdict.
//
// Limits: 100 req/min and 2,000 req/hr per actor.

import { adminClient } from "./supabase";
import type { Env } from "./index";

export type RateLimitVerdict = {
  allowed: boolean;
  reason: string | null;
  minuteCount: number;
  hourCount: number;
  retryAfterSeconds: number;
};

export async function checkRateLimit(
  env: Env,
  actor: string,
): Promise<RateLimitVerdict> {
  const sb = adminClient(env);
  const { data, error } = await sb.rpc("check_and_increment_rate_limit", {
    p_actor: actor,
  });
  if (error) {
    // If the rate-limit infra itself errors, fail open with a logged
    // warning rather than locking the entire MCP surface out. The
    // alternative (fail-closed) would mean a Supabase outage takes the
    // server offline; the audit table still records every write so we
    // can detect abuse after the fact.
    console.warn("rate-limit RPC failed:", error.message);
    return {
      allowed: true,
      reason: null,
      minuteCount: 0,
      hourCount: 0,
      retryAfterSeconds: 0,
    };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: row?.allowed ?? true,
    reason: row?.reason ?? null,
    minuteCount: row?.minute_count ?? 0,
    hourCount: row?.hour_count ?? 0,
    retryAfterSeconds: row?.retry_after_seconds ?? 0,
  };
}
