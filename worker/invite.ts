// POST /api/invite { email }
// Generates a magic-link sign-in URL for the given email using Supabase's
// admin API (no email is sent — the dashboard returns the URL so the
// owner can share it via SMS, WhatsApp, in person, etc).
//
// Auth: caller must present a valid Supabase user JWT in the Authorization
// header AND have profile role = 'owner'. We verify both server-side using
// the service-role key.

import { createClient } from "@supabase/supabase-js";
import { corsHeaders, type Env } from "./index";

export async function handleInviteRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const auth = request.headers.get("authorization") ?? "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!jwt) return json({ error: "missing bearer token" }, 401);

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(
      {
        error:
          "Server is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY secrets.",
      },
      503,
    );
  }

  // Service-role client — used both to verify the caller's JWT (via
  // auth.getUser) and to call the admin API.
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return json({ error: "invalid token" }, 401);
  }
  const userId = userData.user.id;

  const { data: profile, error: profileErr } = await sb
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (profileErr || !profile) {
    return json({ error: "profile not found" }, 403);
  }
  if (profile.role !== "owner") {
    return json({ error: "only owners can invite" }, 403);
  }

  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) {
    return json({ error: "valid email required" }, 400);
  }

  const origin = new URL(request.url).origin;
  const { data: linkData, error: linkErr } =
    await sb.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${origin}/` },
    });

  if (linkErr) {
    return json({ error: linkErr.message }, 502);
  }

  const action_link =
    linkData?.properties?.action_link ?? null;
  if (!action_link) {
    return json({ error: "Supabase returned no link" }, 502);
  }

  return json({ ok: true, email, action_link });
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
