// Cloudflare Worker entry. Routes:
//   GET  /health                 → ok (sanity check)
//   POST /api/mcp                → MCP JSON-RPC, with `Authorization: Bearer <key>`
//   POST /api/mcp/<key>          → MCP JSON-RPC, key in path (for clients
//                                   that can't set headers, e.g. Claude.ai
//                                   personal-account custom connectors)
//   anything else                → static asset fallthrough (the dashboard SPA)

import { handleInviteRequest } from "./invite";
import { handleMcpRequest } from "./mcp";

export type Env = {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MCP_API_KEY: string;
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
      const pathKey = pathMatch[1];
      const headerAuth = request.headers.get("authorization") ?? "";
      const headerKey = headerAuth.startsWith("Bearer ")
        ? headerAuth.slice(7).trim()
        : null;
      const provided = pathKey ?? headerKey;
      if (!env.MCP_API_KEY || provided !== env.MCP_API_KEY) {
        return Response.json(
          { error: "unauthorized" },
          { status: 401, headers: corsHeaders() },
        );
      }
      return handleMcpRequest(request, env);
    }

    // Everything else → the dashboard SPA / its assets.
    return env.ASSETS.fetch(request);
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
