import type { AgentSnapshot } from "./types";

// Adapter layer. The default implementation calls our own /api/agent/*
// endpoints (which proxy to OpenAI). Swap `getAdapter()` to plug in a
// webhook relay or manual JSON ingestion later.

export type AgentAdapter = {
  status(): Promise<AgentSnapshot>;
  act(command: string): Promise<AgentSnapshot>;
};

type ApiResponse = {
  ok: boolean;
  data: Omit<AgentSnapshot, "fetchedAt">;
  fetchedAt: string;
  error?: string;
};

const httpAdapter: AgentAdapter = {
  async status() {
    const res = await fetch("/api/agent/status");
    return parse(res);
  },
  async act(command: string) {
    const res = await fetch("/api/agent/act", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command }),
    });
    return parse(res);
  },
};

async function parse(res: Response): Promise<AgentSnapshot> {
  const text = await res.text();
  let body: ApiResponse | { error?: string };
  try {
    body = JSON.parse(text) as ApiResponse;
  } catch {
    throw new Error(`Agent response was not JSON (HTTP ${res.status})`);
  }
  if (!res.ok || !("ok" in body) || !body.ok) {
    const msg = "error" in body && body.error ? body.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return { ...body.data, fetchedAt: body.fetchedAt };
}

export function getAdapter(): AgentAdapter {
  return httpAdapter;
}
