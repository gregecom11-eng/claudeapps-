import { callOpenAI, json, bad, type Env } from "./_lib";

// POST /api/agent/act { command: string }
// Sends a single user command to the agent and returns normalized output.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { command?: unknown };
  try {
    body = (await request.json()) as { command?: unknown };
  } catch {
    return bad("Invalid JSON body");
  }
  const command = typeof body.command === "string" ? body.command.trim() : "";
  if (!command) return bad("Missing 'command' string");
  if (command.length > 2000) return bad("'command' too long (max 2000 chars)");

  if (!env.OPENAI_API_KEY) {
    return bad(
      "Agent not configured. Set OPENAI_API_KEY to enable commands.",
      503,
    );
  }

  try {
    const result = await callOpenAI(env, command);
    return json({ ok: true, data: result, fetchedAt: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return bad(msg, 502);
  }
};
