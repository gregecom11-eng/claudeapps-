// Minimal MCP server speaking JSON-RPC 2.0 over HTTP.
// Implements just enough for Claude.ai's "Custom Connector" UX:
//   - initialize          (handshake; returns server info + capabilities)
//   - notifications/*     (no-ops; we ack)
//   - ping                (returns {})
//   - tools/list          (returns the tool catalog)
//   - tools/call          (invokes a named tool)
//
// We deliberately avoid the @modelcontextprotocol/sdk Node-isms so this
// stays small and Workers-native.

import { json, type Env, corsHeaders } from "./index";
import { TOOL_SCHEMAS, executeTool } from "./tools";

type JsonRpcReq = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
};

type JsonRpcRes =
  | {
      jsonrpc: "2.0";
      id: string | number | null;
      result: unknown;
    }
  | {
      jsonrpc: "2.0";
      id: string | number | null;
      error: { code: number; message: string; data?: unknown };
    };

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "sdluxury-mcp", version: "0.1.0" };

export async function handleMcpRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error");
  }

  // Handle batched requests (rare but spec'd).
  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map((req) => handleSingle(req as JsonRpcReq, env)),
    );
    const filtered = responses.filter((r): r is JsonRpcRes => r !== null);
    return new Response(JSON.stringify(filtered), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...corsHeaders(),
      },
    });
  }

  const res = await handleSingle(body as JsonRpcReq, env);
  if (res === null) {
    // Notification — no body, 202 Accepted.
    return new Response(null, { status: 202, headers: corsHeaders() });
  }
  return new Response(JSON.stringify(res), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

async function handleSingle(
  req: JsonRpcReq,
  env: Env,
): Promise<JsonRpcRes | null> {
  if (!req || req.jsonrpc !== "2.0" || typeof req.method !== "string") {
    return errorRes(req?.id ?? null, -32600, "Invalid Request");
  }

  // Notifications have no id; we don't reply (return null → 202 Accepted).
  const isNotification = req.id === undefined || req.id === null;

  try {
    switch (req.method) {
      case "initialize":
        return okRes(req.id ?? null, {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: SERVER_INFO,
          capabilities: {
            tools: { listChanged: false },
            // resources/prompts/sampling not implemented.
          },
          instructions:
            "SDLuxury Operations server. Use create_ride to schedule rides, list_rides to view the schedule, update_ride_status to mark progress. Always confirm pickup_at and pickup_address from the user before creating a ride.",
        });

      case "notifications/initialized":
      case "notifications/cancelled":
      case "notifications/progress":
      case "notifications/roots/list_changed":
        return null; // ack

      case "ping":
        return okRes(req.id ?? null, {});

      case "tools/list":
        return okRes(req.id ?? null, { tools: TOOL_SCHEMAS });

      case "tools/call": {
        const params = (req.params ?? {}) as {
          name?: string;
          arguments?: Record<string, unknown>;
        };
        const name = params.name;
        const args = params.arguments ?? {};
        if (!name) {
          return errorRes(req.id ?? null, -32602, "Missing tool name");
        }
        const result = await executeTool(name, args, env);
        return okRes(req.id ?? null, result);
      }

      // resources/list, prompts/list etc. — return empty so clients don't error.
      case "resources/list":
        return okRes(req.id ?? null, { resources: [] });
      case "resources/templates/list":
        return okRes(req.id ?? null, { resourceTemplates: [] });
      case "prompts/list":
        return okRes(req.id ?? null, { prompts: [] });

      default:
        if (isNotification) return null;
        return errorRes(
          req.id ?? null,
          -32601,
          `Method not found: ${req.method}`,
        );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isNotification) return null;
    return errorRes(req.id ?? null, -32603, msg);
  }
}

function okRes(id: string | number | null, result: unknown): JsonRpcRes {
  return { jsonrpc: "2.0", id, result };
}

function errorRes(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcRes {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
): Response {
  return json(errorRes(id, code, message));
}
