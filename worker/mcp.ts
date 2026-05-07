// Minimal MCP server speaking JSON-RPC 2.0 over HTTP.
// Handles initialize, tools/list, tools/call, plus list-stubs Claude probes.

import { corsHeaders, type Env } from "./index";
import { TOOL_SCHEMAS, executeTool } from "./tools";

type JsonRpcReq = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
};

type JsonRpcRes =
  | { jsonrpc: "2.0"; id: string | number | null; result: unknown }
  | {
      jsonrpc: "2.0";
      id: string | number | null;
      error: { code: number; message: string; data?: unknown };
    };

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "sdluxury-ops", version: "0.2.0" };

export async function handleMcpRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(errorRes(null, -32700, "Parse error"));
  }

  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map((req) => handleSingle(req as JsonRpcReq, env)),
    );
    const filtered = responses.filter((r): r is JsonRpcRes => r !== null);
    return jsonResponse(filtered);
  }

  const res = await handleSingle(body as JsonRpcReq, env);
  if (res === null) {
    return new Response(null, { status: 202, headers: corsHeaders() });
  }
  return jsonResponse(res);
}

async function handleSingle(
  req: JsonRpcReq,
  env: Env,
): Promise<JsonRpcRes | null> {
  if (!req || req.jsonrpc !== "2.0" || typeof req.method !== "string") {
    return errorRes(req?.id ?? null, -32600, "Invalid Request");
  }
  const isNotification = req.id === undefined || req.id === null;

  try {
    switch (req.method) {
      case "initialize":
        return okRes(req.id ?? null, {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: SERVER_INFO,
          capabilities: { tools: { listChanged: false } },
          instructions:
            "SDLuxury Operations server. Use create_ride to schedule rides; list_rides to view the schedule; update_ride_status to mark progress. Always confirm pickup_at and pickup_address with the user before creating a ride.",
        });

      case "notifications/initialized":
      case "notifications/cancelled":
      case "notifications/progress":
      case "notifications/roots/list_changed":
        return null;

      case "ping":
        return okRes(req.id ?? null, {});

      case "tools/list":
        return okRes(req.id ?? null, { tools: TOOL_SCHEMAS });

      case "tools/call": {
        const params = (req.params ?? {}) as {
          name?: string;
          arguments?: Record<string, unknown>;
        };
        if (!params.name) {
          return errorRes(req.id ?? null, -32602, "Missing tool name");
        }
        const result = await executeTool(
          params.name,
          params.arguments ?? {},
          env,
        );
        return okRes(req.id ?? null, result);
      }

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
    if (isNotification) return null;
    const msg = e instanceof Error ? e.message : String(e);
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}
