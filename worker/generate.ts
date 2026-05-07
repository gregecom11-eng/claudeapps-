// POST /api/generate { kind, context }
// Calls the Anthropic API to generate ride packet text. The dashboard
// falls back to a local template when the worker returns 503.
//
// Auth: requires a valid Supabase user JWT for an owner.

import { createClient } from "@supabase/supabase-js";
import { corsHeaders, type Env } from "./index";

const SYSTEM_BY_KIND: Record<string, string> = {
  confirmation: `You are SDLuxury Transportation's ops voice. Write a copy-ready client confirmation message for a private chauffeur ride. Tone: professional, warm, concise. Include: pickup time, pickup address, dropoff address, flight (if applicable), vehicle, driver's first name + phone if provided, total fare, and billing terms. End with: "Your driver will text on approach." Sign off as SDLuxury Transportation. No emojis.`,
  briefing: `You are SDLuxury Transportation's ops voice. Write a short driver briefing for the assigned chauffeur. Tone: direct, operational, no fluff. Include: passenger name + phone, pickup address, dropoff address, flight info if any, vehicle, key dispatch notes, and a reminder to confirm 30 min before pickup. Plain text, no markdown.`,
  waybill: `You are SDLuxury Transportation. Produce a DOT-compliant waybill text block. Plain text in fixed sections. Include: company name, date of service, passenger, pickup time, pickup + dropoff addresses, vehicle, driver, base fare, gratuity, parking, extras (each line item if provided), total, billing terms. End with a "Signature: ____ Date: ____" line.`,
  invoice: `You are SDLuxury Transportation's billing voice. Produce a clean invoice. Include: invoice header with date issued and due date based on terms, bill-to (client + company), line items (private car service date+route, gratuity, parking, any extras), total, and "Remit to: SDLuxury Transportation, Inc.". Tone: precise, professional. Plain text.`,
};

export async function handleGenerateRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const auth = request.headers.get("authorization") ?? "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!jwt) return json({ error: "missing bearer token" }, 401);

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Server not configured for auth checks" }, 503);
  }
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "ANTHROPIC_API_KEY not set" }, 503);
  }

  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
  if (userErr || !userData?.user)
    return json({ error: "invalid token" }, 401);
  const { data: profile } = await sb
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (profile?.role !== "owner")
    return json({ error: "only owners can generate" }, 403);

  let body: { kind?: unknown; context?: unknown };
  try {
    body = (await request.json()) as { kind?: unknown; context?: unknown };
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const kind = typeof body.kind === "string" ? body.kind : "";
  if (!SYSTEM_BY_KIND[kind]) {
    return json({ error: `unknown kind: ${kind}` }, 400);
  }
  if (!body.context || typeof body.context !== "object") {
    return json({ error: "missing context" }, 400);
  }

  const model = env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
  const userMessage = [
    `Generate the ${kind} text using these ride details:`,
    "```json",
    JSON.stringify(body.context, null, 2),
    "```",
    "Output the text only, no explanation.",
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system: SYSTEM_BY_KIND[kind],
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return json(
      { error: `Anthropic ${res.status}: ${text.slice(0, 400)}` },
      502,
    );
  }
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text =
    data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  if (!text) return json({ error: "Empty response from Anthropic" }, 502);

  return json({ ok: true, kind, text, model });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}
