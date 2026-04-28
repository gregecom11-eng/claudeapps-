import { callOpenAI, json, bad, type Env } from "./_lib";

// GET /api/agent/status
// Returns the agent's current normalized status. Safe to poll.
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.OPENAI_API_KEY) {
    return bad(
      "Agent not configured. Set OPENAI_API_KEY to enable live status.",
      503,
    );
  }
  try {
    const result = await callOpenAI(
      env,
      "Report your current status now. No new commands have been issued.",
    );
    return json({ ok: true, data: result, fetchedAt: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return bad(msg, 502);
  }
};
