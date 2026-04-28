// Optional cross-device sync via a private GitHub gist.
// GET  /api/sync/gist           -> returns latest stored snapshot
// POST /api/sync/gist  { data } -> writes snapshot, returns { id, updatedAt }

type Env = {
  GITHUB_GIST_TOKEN?: string;
  GITHUB_GIST_ID?: string;
};

const FILE = "limo-dashboard.json";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const gh = (token: string) => ({
  authorization: `Bearer ${token}`,
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28",
  "user-agent": "limo-agent-dashboard",
});

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.GITHUB_GIST_TOKEN) return json({ error: "Sync not configured" }, 503);
  if (!env.GITHUB_GIST_ID) return json({ ok: true, data: null });
  const res = await fetch(`https://api.github.com/gists/${env.GITHUB_GIST_ID}`, {
    headers: gh(env.GITHUB_GIST_TOKEN),
  });
  if (!res.ok) return json({ error: `gist ${res.status}` }, 502);
  const data = (await res.json()) as {
    files?: Record<string, { content?: string }>;
    updated_at?: string;
  };
  const content = data.files?.[FILE]?.content ?? null;
  return json({
    ok: true,
    data: content ? JSON.parse(content) : null,
    updatedAt: data.updated_at,
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.GITHUB_GIST_TOKEN) return json({ error: "Sync not configured" }, 503);
  let body: { data?: unknown };
  try {
    body = (await request.json()) as { data?: unknown };
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.data) return json({ error: "Missing 'data'" }, 400);

  const payload = {
    description: "Limo Agent Dashboard snapshot",
    public: false,
    files: { [FILE]: { content: JSON.stringify(body.data, null, 2) } },
  };

  const url = env.GITHUB_GIST_ID
    ? `https://api.github.com/gists/${env.GITHUB_GIST_ID}`
    : "https://api.github.com/gists";
  const res = await fetch(url, {
    method: env.GITHUB_GIST_ID ? "PATCH" : "POST",
    headers: { ...gh(env.GITHUB_GIST_TOKEN), "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return json({ error: `gist ${res.status}` }, 502);
  const data = (await res.json()) as { id?: string; updated_at?: string };
  return json({ ok: true, id: data.id, updatedAt: data.updated_at });
};
