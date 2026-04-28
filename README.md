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
| `npm run seed`    | Print mock data JSON (use to bootstrap settings) |

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
