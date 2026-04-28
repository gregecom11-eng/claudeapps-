// Shared helpers for /api/agent/* Pages Functions.
// Runs on Cloudflare Workers runtime — no Node APIs.

export type Env = {
  OPENAI_API_KEY?: string;
  OPENAI_PROJECT_ID?: string;
  OPENAI_AGENT_ID?: string;
  OPENAI_MODEL?: string;
};

export type NormalizedAgentResponse = {
  summary: string;
  currentStep: string;
  confidence: number;
  todos: { title: string; status: "planned" | "in_progress" | "done" }[];
  events: { title: string; datetime: string; location?: string; notes?: string }[];
  logs: { source: string; message: string; timestamp: string }[];
};

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export const bad = (msg: string, status = 400) => json({ error: msg }, status);

const SYSTEM = `You are the operations brain for a limousine business. Always respond with strict JSON matching this TypeScript type:
{
  "summary": string,           // one-sentence status
  "currentStep": string,       // what is happening right now
  "confidence": number,        // 0..1
  "todos":  { "title": string, "status": "planned" | "in_progress" | "done" }[],
  "events": { "title": string, "datetime": string, "location"?: string, "notes"?: string }[],
  "logs":   { "source": string, "message": string, "timestamp": string }[]
}
Datetimes must be ISO-8601. Keep arrays short (<= 8 items). No prose outside JSON.`;

export async function callOpenAI(
  env: Env,
  userInput: string,
): Promise<NormalizedAgentResponse> {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing on server");

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${env.OPENAI_API_KEY}`,
  };
  if (env.OPENAI_PROJECT_ID) headers["openai-project"] = env.OPENAI_PROJECT_ID;

  const agentNote = env.OPENAI_AGENT_ID
    ? `\nThis request is on behalf of agent ${env.OPENAI_AGENT_ID}.`
    : "";

  const body = {
    model: env.OPENAI_MODEL || "gpt-4.1-mini",
    input: [
      { role: "system", content: SYSTEM + agentNote },
      { role: "user", content: userInput },
    ],
    text: { format: { type: "json_object" } },
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    output_text?: string;
    output?: { content?: { text?: string }[] }[];
  };

  // The Responses API returns either output_text or a structured output array.
  const raw =
    data.output_text ??
    data.output?.[0]?.content?.[0]?.text ??
    "";

  return normalize(raw);
}

export function normalize(raw: string): NormalizedAgentResponse {
  let parsed: Partial<NormalizedAgentResponse> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { summary: raw.slice(0, 300) };
  }
  const safeArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    currentStep: typeof parsed.currentStep === "string" ? parsed.currentStep : "",
    confidence:
      typeof parsed.confidence === "number"
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0,
    todos: safeArr<NormalizedAgentResponse["todos"][number]>(parsed.todos),
    events: safeArr<NormalizedAgentResponse["events"][number]>(parsed.events),
    logs: safeArr<NormalizedAgentResponse["logs"][number]>(parsed.logs),
  };
}
