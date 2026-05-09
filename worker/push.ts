// Push subscription management + one-time VAPID setup endpoint.
//
//   GET  /api/push/vapid-public         (anyone) → returns the VAPID
//                                         public key the browser uses
//                                         to subscribe.
//   POST /api/push/subscribe            (auth) → store this user's
//                                         subscription.
//   POST /api/push/unsubscribe          (auth) → remove by endpoint.
//   POST /api/push/test                 (auth) → send a "you're wired
//                                         up" push to all of this
//                                         user's devices. Used by the
//                                         Settings page.
//   GET  /api/push/vapid-setup          (owner) → generate a fresh
//                                         keypair and show it once,
//                                         with paste-into-Cloudflare
//                                         instructions. NOT stored.

import { createClient } from "@supabase/supabase-js";
import { corsHeaders, type Env } from "./index";
import { generateVapidKeys, sendPush } from "./webpush";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

async function authedUser(
  request: Request,
  env: Env,
): Promise<{ id: string; role: string | null } | null> {
  const auth = request.headers.get("authorization") ?? "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!jwt) return null;
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(jwt);
  if (error || !data?.user) return null;
  const { data: profile } = await sb
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  return { id: data.user.id, role: profile?.role ?? null };
}

export async function handleVapidPublic(env: Env): Promise<Response> {
  if (!env.VAPID_PUBLIC_KEY) {
    return json({ error: "VAPID not configured" }, 503);
  }
  return json({ key: env.VAPID_PUBLIC_KEY });
}

export async function handleVapidSetup(
  request: Request,
  env: Env,
): Promise<Response> {
  const user = await authedUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (user.role !== "owner") return json({ error: "forbidden" }, 403);
  const { publicKey, privateKey } = await generateVapidKeys();
  return json({
    ok: true,
    note:
      "Paste these as Cloudflare secrets, then redeploy. Save them — this is the ONLY time you'll see them.",
    secrets: {
      VAPID_PUBLIC_KEY: publicKey,
      VAPID_PRIVATE_KEY: privateKey,
      VAPID_SUBJECT:
        env.VAPID_SUBJECT ?? "mailto:owner@sdluxurytransportation.com",
    },
  });
}

export async function handleSubscribe(
  request: Request,
  env: Env,
): Promise<Response> {
  const user = await authedUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
    user_agent?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh =
    typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const authKey = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || !p256dh || !authKey) {
    return json({ error: "missing endpoint/keys" }, 400);
  }

  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth: authKey,
      user_agent:
        typeof body.user_agent === "string"
          ? body.user_agent
          : request.headers.get("user-agent"),
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) return json({ error: error.message }, 502);
  return json({ ok: true });
}

export async function handleTestSend(
  request: Request,
  env: Env,
): Promise<Response> {
  const user = await authedUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return json({ error: "VAPID not configured" }, 503);
  }
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user.id);
  if (!subs || subs.length === 0) {
    return json({ error: "no subscribed devices" }, 404);
  }
  const payload = JSON.stringify({
    title: "Test notification",
    body: "If you can see this, push is wired up correctly.",
    url: "/settings",
    tag: "test-push",
    urgency: "high",
  });
  let ok = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        const r = await sendPush(
          env,
          {
            endpoint: s.endpoint as string,
            keys: { p256dh: s.p256dh as string, auth: s.auth as string },
          },
          payload,
          { ttl: 60, urgency: "high" },
        );
        if (r.ok) ok++;
        else failed++;
        if (r.gone) {
          await sb.from("push_subscriptions").delete().eq("id", s.id);
        }
      } catch {
        failed++;
      }
    }),
  );
  return json({ ok: true, sent: ok, failed, devices: subs.length });
}

export async function handleUnsubscribe(
  request: Request,
  env: Env,
): Promise<Response> {
  const user = await authedUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: { endpoint?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return json({ error: "missing endpoint" }, 400);
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await sb
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);
  return json({ ok: true });
}
