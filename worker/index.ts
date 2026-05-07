// Cloudflare Worker entry. Routes:
//   GET  /health      → ok (sanity check)
//   POST /api/mcp     → MCP JSON-RPC endpoint (Claude.ai connector talks to this)
//   anything else     → static asset fallthrough (the dashboard SPA)

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

    if (url.pathname === "/api/mcp") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }
      const auth = request.headers.get("authorization") ?? "";
      if (!env.MCP_API_KEY || auth !== `Bearer ${env.MCP_API_KEY}`) {
        return Response.json(
          { error: "unauthorized" },
          { status: 401, headers: corsHeaders() },
        );
      }
      if (request.method !== "POST") {
        return Response.json(
          { error: "method not allowed" },
          { status: 405, headers: corsHeaders() },
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
