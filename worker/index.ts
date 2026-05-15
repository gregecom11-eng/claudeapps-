// Cloudflare Worker entry. Routes:
//   GET  /health                 → ok (sanity check)
//   POST /api/mcp                → MCP JSON-RPC, with `Authorization: Bearer <key>`
//   POST /api/mcp/<key>          → MCP JSON-RPC, key in path (DEPRECATED;
//                                   accepted until 2026-05-22 for backward
//                                   compatibility, with a Deprecation header).
//   anything else                → static asset fallthrough (the dashboard SPA)

import { authenticate } from "./auth";
import { runScheduled } from "./cron";
import { handleGenerateRequest } from "./generate";
import { handleInviteRequest } from "./invite";
import { handleMcpRequest } from "./mcp";
import { checkRateLimit } from "./rate-limit";
import {
  handleSubscribe,
  handleTestSend,
  handleUnsubscribe,
  handleVapidPublic,
  handleVapidSetup,
} from "./push";

export type Env = {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MCP_API_KEY: string;
  // Optional second token for the dashboard's own write paths.
  // Maps to actor identifier "dashboard:greg" in worker/auth.ts.
  DASHBOARD_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "claudeapps-1" });
    }

    // Owner-only: generate a magic-link sign-in URL for a driver/client.
    // Doesn't email — returns the link so the caller can share it via SMS,
    // WhatsApp, etc. Avoids the Supabase free-tier email rate limit.
    if (url.pathname === "/api/invite") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }
      if (request.method !== "POST") {
        return Response.json(
          { error: "method not allowed" },
          { status: 405, headers: corsHeaders() },
        );
      }
      return handleInviteRequest(request, env);
    }

    // Push notifications (Web Push)
    if (url.pathname === "/api/push/vapid-public") {
      if (request.method !== "GET")
        return Response.json(
          { error: "method not allowed" },
          { status: 405, headers: corsHeaders() },
        );
      return handleVapidPublic(env);
    }
    if (url.pathname === "/api/push/vapid-setup") {
      if (request.method !== "GET")
        return Response.json(
          { error: "method not allowed" },
          { status: 405, headers: corsHeaders() },
        );
      return handleVapidSetup(request, env);
    }
    if (url.pathname === "/api/push/subscribe") {
      if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers: corsHeaders() });
      if (request.method !== "POST")
        return Response.json(
          { error: "method not allowed" },
          { status: 405, headers: corsHeaders() },
        );
      return handleSubscribe(request, env);
    }
    if (url.pathname === "/api/push/test") {
      if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers: corsHeaders() });
      if (request.method !== "POST")
        return Response.json(
          { error: "method not allowed" },
          { status: 405, headers: corsHeaders() },
        );
      return handleTestSend(request, env);
    }
    if (url.pathname === "/api/push/unsubscribe") {
      if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers: corsHeaders() });
      if (request.method !== "POST")
        return Response.json(
          { error: "method not allowed" },
          { status: 405, headers: corsHeaders() },
        );
      return handleUnsubscribe(request, env);
    }

    // Owner-only: generate ride packet text via Anthropic.
    if (url.pathname === "/api/generate") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }
      if (request.method !== "POST") {
        return Response.json(
          { error: "method not allowed" },
          { status: 405, headers: corsHeaders() },
        );
      }
      return handleGenerateRequest(request, env);
    }

    // /api/mcp        (uses Authorization header)
    // /api/mcp/<key>  (key in URL path)
    const pathMatch = url.pathname.match(/^\/api\/mcp(?:\/([^/]+))?\/?$/);
    if (pathMatch) {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }
      // GET on /api/mcp returns a small handshake response. Some MCP clients
      // probe the URL with GET before they POST; returning 405 makes them
      // mark the connector as "not connecting".
      if (request.method === "GET") {
        return Response.json(
          {
            ok: true,
            service: "sdluxury-ops",
            transport: "POST application/json (JSON-RPC 2.0)",
          },
          { headers: corsHeaders() },
        );
      }
      if (request.method !== "POST") {
        return Response.json(
          { error: "method not allowed" },
          { status: 405, headers: corsHeaders() },
        );
      }
      const pathKey = pathMatch[1] ?? null;
      const auth = authenticate(request, env, pathKey);
      if (!auth.ok) {
        return Response.json(
          { error: auth.error, status: 401 },
          { status: 401, headers: corsHeaders() },
        );
      }

      // Rate-limit per actor. 100/min, 2,000/hr (configured in the RPC).
      const rl = await checkRateLimit(env, auth.actor);
      if (!rl.allowed) {
        return Response.json(
          {
            error: rl.reason ?? "rate limit exceeded",
            status: 429,
            minute_count: rl.minuteCount,
            hour_count: rl.hourCount,
          },
          {
            status: 429,
            headers: {
              ...corsHeaders(),
              "retry-after": String(Math.max(1, rl.retryAfterSeconds)),
            },
          },
        );
      }

      const extraHeaders: HeadersInit = {};
      if (auth.viaUrl && auth.deprecationWarning) {
        extraHeaders["deprecation"] = "true";
        extraHeaders["warning"] = `299 - "${auth.deprecationWarning}"`;
        extraHeaders["sunset"] = "Fri, 22 May 2026 00:00:00 GMT";
      }
      return handleMcpRequest(
        request,
        env,
        { actor: auth.actor },
        extraHeaders,
      );
    }

    // Everything else → the dashboard SPA / its assets.
    return env.ASSETS.fetch(request);
  },

  // Cloudflare cron trigger (see wrangler.jsonc → triggers.crons).
  // Sends pickup-reminder pushes to drivers ~90 min before each ride
  // and notifies owners when a /book request lands.
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(runScheduled(env));
  },
};

export function corsHeaders(): HeadersInit {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers":
      "content-type, authorization, mcp-session-id",
    "access-control-max-age": "86400",
  };
}
