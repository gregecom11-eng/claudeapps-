// Cloudflare Worker entry. Routes:
//   GET  /health     → returns ok (sanity check)
//   POST /mcp        → MCP JSON-RPC endpoint (Claude.ai connector talks to this)
//   anything else    → 404
//
// Auth: Bearer <MCP_API_KEY> in the Authorization header.
// Set the secrets with:  wrangler secret put SUPABASE_URL
//                        wrangler secret put SUPABASE_SERVICE_ROLE_KEY
//                        wrangler secret put MCP_API_KEY

import { handleMcpRequest } from "./mcp";

export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MCP_API_KEY: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight (Claude doesn't actually need this, but other MCP clients do).
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === "/health") {
      return json({ ok: true, service: "sdluxury-mcp" });
    }

    if (url.pathname === "/mcp") {
      const auth = request.headers.get("authorization") ?? "";
      const expected = `Bearer ${env.MCP_API_KEY}`;
      if (!env.MCP_API_KEY || auth !== expected) {
        return json({ error: "unauthorized" }, 401);
      }
      if (request.method !== "POST") {
        return json({ error: "method not allowed" }, 405);
      }
      return handleMcpRequest(request, env);
    }

    return json(
      {
        error: "not found",
        hint: "POST /mcp with a JSON-RPC body, or GET /health",
      },
      404,
    );
  },
};

export function corsHeaders(): HeadersInit {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization, mcp-session-id",
    "access-control-max-age": "86400",
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}
