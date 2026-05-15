# Limo Agent Dashboard

Minimal, mobile-first dashboard for tracking your limousine business and the
ChatGPT agent that runs alongside it: tasks, events (upcoming + past),
activity feed, and a live panel for the agent's current objective.

- **Frontend**: Vite + React + TypeScript, no UI framework (light CSS)
- **Storage**: local-first (`localStorage`) with JSON export/import
- **Cloud sync**: optional, via a private GitHub Gist (token kept server-side)
- **Agent**: server-side proxy to the OpenAI Responses API; adapter layer
  lets you swap in a webhook or manual JSON later
- **PWA**: installable on phone, basic offline shell
- **Deploy**: Cloudflare Pages (full functionality) or GitHub Pages
  (static-only — agent endpoints disabled)

## Quick start

```bash
npm install
cp .env.example .env       # only needed for live agent / sync
npm run dev                # http://localhost:5173
```

When `npm run dev` is running, agent calls go to `/api/agent/*`. To exercise
those locally, run Cloudflare's Pages dev server in a second terminal:

```bash
npx wrangler@latest pages dev dist --compatibility-date=2024-09-01
# vite proxies /api → http://localhost:8788
```

If you don't run wrangler, the UI still works — only the agent panel will
show errors when it polls.

## Scripts

| command           | what it does                                      |
| ----------------- | ------------------------------------------------- |
| `npm run dev`     | Vite dev server with HMR                          |
| `npm run build`   | Type-check + production build to `dist/`         |
| `npm run preview` | Preview the production build                      |
| `npm run typecheck` | TypeScript only, no emit                        |
| `npm run test`    | Run the worker test suite (vitest)               |
| `npm run seed`    | Print mock data JSON (use to bootstrap settings) |

## MCP server

This deployment also exposes an MCP (Model Context Protocol) endpoint so
Claude — or any MCP-aware client — can read and edit ride data through
typed tools. As of Session 3 (May 2026) the surface is feature-complete
for the current roadmap.

| tool                   | what it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `create_ride`          | Schedule a new ride.                                       |
| `update_ride`          | Edit any combination of fields on an existing ride.       |
| `update_ride_status`   | Move a ride between `scheduled` / `in_progress` / etc.    |
| `list_rides`           | Return rides for a date / range / status (capped at 50).  |
| `find_or_create_client`| Look up a recurring client by name, create if missing.    |
| `update_client`        | Edit a client; archives prior address on `home_address`.  |
| `link_ride_to_client`  | Retroactively link an orphan ride to a client.            |
| `add_driver`           | Create a new driver; rejects case-insensitive duplicates. |
| `update_driver`        | Edit a driver; setting `status=inactive` warns + hides.   |
| `list_drivers`         | List active drivers (capped at 50).                       |
| `list_vehicles`        | List active vehicles (capped at 50).                      |
| `log_activity`         | Append a free-form note to the dashboard activity feed.   |

Every write tool returns `{ before, after, changed_fields, audit_id,
warnings }` (or `{ driver, audit_id, warnings }` for `add_driver`), so
the caller can verify the change took effect. Writes are atomic via
SECURITY DEFINER RPCs in Postgres (`apply_ride_update_v1`,
`apply_client_update_v1`, `apply_ride_link_client_v1`,
`apply_driver_create_v1`, `apply_driver_update_v1`).

### Authentication

The Worker authenticates every MCP call against a per-caller token kept
in Cloudflare Workers secrets. Two equivalent transports are supported:

**Header form (preferred for any client that can set headers):**

```http
POST /api/mcp HTTP/1.1
Host: claudeapps-1.gregecom11.workers.dev
Authorization: Bearer <YOUR_TOKEN>
Content-Type: application/json
```

**URL-token form (for Claude.ai custom connectors and any client that
can only supply a URL):**

```
POST /api/mcp/<YOUR_TOKEN>
```

Both forms are first-class and will remain supported. The URL form is
the only option for Claude.ai personal-account custom connectors, which
don't expose a way to set headers.

Each token maps to an actor identifier (`mcp:claude` for the canonical
Claude MCP token, `dashboard:greg` for the dashboard's own writes). The
actor is recorded on every write (`rides.updated_by`, `audit.actor`,
`events.source`); a request that doesn't match a known token is rejected
with 401 before any data is read.

To rotate the token:

```bash
npx wrangler secret put MCP_API_KEY
# paste new value
```

To add an additional caller:

```bash
npx wrangler secret put DASHBOARD_API_KEY
```

### Rate limits

Each actor is capped at **100 requests/minute** and **2,000
requests/hour**. Exceeding either returns HTTP 429 with a
`Retry-After` header. Counters live in `mcp_rate_limits` (Postgres) and
are evaluated by the `check_and_increment_rate_limit` RPC.

### PII redaction (activity feed)

The dashboard activity feed (`events` table) shows redacted versions of
sensitive fields:

| field             | feed display                |
| ----------------- | --------------------------- |
| phone numbers     | `***-***-1086` (last 4 only) |
| email addresses   | `g***@gmail.com` (initial + domain) |
| home / pickup addresses | `Newport Beach, CA` (city + state) |
| flight numbers    | shown as-is — not PII       |
| names             | shown as-is — operator needs to read them |

The **audit table** (`audit`) stores the FULL pre- and post-change row
JSON without redaction (Supabase encrypts at rest). It is the canonical
record of what happened; the activity feed is just a human-readable
mirror with PII removed.

Owner-only read access is enforced via RLS (`audit_owner_read`); the
Worker writes via the service role.

### Response cap

All list-style tools (`list_rides`, `list_drivers`, `list_vehicles`)
return **at most 50 rows per call**. When more rows exist, the response
includes `has_more: true` and a `next_cursor` opaque string; pass that
`cursor` argument on the next call to continue. This prevents a single
compromised request from dumping the database.

### Audit table

| column          | type   | notes                                  |
| --------------- | ------ | -------------------------------------- |
| `id`            | uuid   | primary key                            |
| `entity_type`   | text   | `ride` / `client` / `driver`           |
| `entity_id`     | uuid   | id of the affected row                 |
| `action`        | text   | `update` / `create` / `link`           |
| `changed_fields`| text   | JSON array of field names              |
| `before_json`   | text   | full row snapshot pre-change           |
| `after_json`    | text   | full row snapshot post-change          |
| `actor`         | text   | e.g. `mcp:claude`, `dashboard:greg`    |
| `created_at`    | timestamptz | UTC                              |

Inserts go through `apply_ride_update_v1` so the ride update + audit row
+ activity event are written in one transaction.

## Deploy

### Option A — Cloudflare Pages (recommended; functions work)

1. Push this repo to GitHub.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Build command: `npm run build` · Output directory: `dist`.
4. Settings → Environment variables (Production):
   - `OPENAI_API_KEY`
   - `OPENAI_PROJECT_ID` (optional)
   - `OPENAI_AGENT_ID` (optional)
   - `OPENAI_MODEL` (optional, default `gpt-4.1-mini`)
   - `GITHUB_GIST_TOKEN` (optional, for sync)
   - `GITHUB_GIST_ID` (optional)
5. Deploy. Cloudflare auto-detects `functions/` and routes `/api/*` to them.

### Option B — GitHub Pages (static only, no agent)

1. GitHub → repo → Settings → Pages → Source: **GitHub Actions**.
2. Push to `main`. The included workflow (`.github/workflows/deploy.yml`)
   builds with `BASE_PATH=/<repo>/` and deploys.
3. The agent panel will show "Agent not configured" because Pages can't run
   server-side code. Tasks, events, backups, and PWA install all work.

## Mobile install (PWA)

- iOS Safari → Share → "Add to Home Screen".
- Android Chrome → ⋮ → "Install app" (or "Add to Home Screen").
- Subsequent loads work offline for previously-loaded data.

## Connect your ChatGPT agent

The server route at `functions/api/agent/_lib.ts` calls
`https://api.openai.com/v1/responses`. To wire your agent:

1. Generate an API key at <https://platform.openai.com/api-keys>.
2. Set `OPENAI_API_KEY` (and `OPENAI_PROJECT_ID` if you scope keys per project)
   on Cloudflare Pages → Environment variables.
3. If you have a named agent / assistant, set `OPENAI_AGENT_ID` — it's woven
   into the system prompt as context. (The Responses API call itself is
   model-based; if you need the Assistants API, swap `callOpenAI()`.)
4. Optional: change the model with `OPENAI_MODEL`.

The agent must reply with strict JSON matching the schema in `_lib.ts`. The
server also normalizes/clamps the response, so a slightly off reply still
renders gracefully.

### Swap the adapter

`src/lib/agent.ts` exposes `getAdapter()`. Replace it with:

- a webhook adapter that POSTs to your relay,
- a manual adapter that reads/writes JSON in localStorage,
- or anything else that returns an `AgentSnapshot`.

## Cloud sync (optional, free)

Create a GitHub PAT with `gist` scope, set `GITHUB_GIST_TOKEN` on the server.
Press **Push** in Settings to write a private gist, **Pull** to restore on
another device. The token never reaches the browser.

## Security notes

- API keys live only as Cloudflare environment variables.
- The client validates input length and sanitizes JSON parsing.
- Nothing in the bundle calls OpenAI or GitHub directly.

## Next actions for you

- [ ] Push this branch and merge to `main` (or open a PR).
- [ ] Pick a deploy target (Cloudflare Pages or GitHub Pages) and follow
      the section above.
- [ ] Add `OPENAI_API_KEY` (+ optional `OPENAI_AGENT_ID`).
- [ ] Open the deployed URL on your phone → Add to Home Screen.
- [ ] In Settings, click "Load seed data" or hit "Export JSON" once to
      capture a backup template.
- [ ] (Optional) Add `GITHUB_GIST_TOKEN` for cross-device sync.
- [ ] Adjust the system prompt in `functions/api/agent/_lib.ts` to match
      your agent's voice and field expectations.
