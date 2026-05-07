# SDLuxury MCP Server

A tiny Cloudflare Worker that lets Claude.ai (Pro / Max / Team) create and
manage rides in your SDLuxury Operations dashboard. Ask Claude *"Create a
ride for Kevin Morgan, LAX pickup tomorrow 7am"* and it appears on the
dashboard for you and your team.

Tools exposed to Claude:

- `create_ride` — schedule a new ride
- `list_rides` — see today / tomorrow / a specific date
- `update_ride_status` — mark in progress / completed / cancelled
- `find_or_create_client` — recurring client lookup
- `list_drivers`, `list_vehicles`
- `log_activity` — leave a note in the dashboard's activity feed

---

## One-time setup (~10 minutes)

You'll need:
- A terminal (macOS Terminal, Windows PowerShell, or your code editor's).
- Your Supabase **service role key** (the secret one — never expose to a browser).
- A long random string to use as the MCP API key (we'll generate it).

### 1. Get your Supabase service-role key

1. Open your Supabase project → **Settings** → **API**.
2. Copy the value labeled **service_role** (or **secret** in the new naming).
   It's a long string starting with `eyJ...` or `sb_secret_...`.
3. Keep it on your clipboard — you'll paste it in step 4.

### 2. Open a terminal in `mcp-server/`

```bash
cd mcp-server
npm install
```

### 3. Log into Cloudflare

```bash
npx wrangler login
```

This opens your browser. Approve the access. Close the tab.

### 4. Set the three secrets

Run each, paste the value when prompted, press Enter:

```bash
npx wrangler secret put SUPABASE_URL
# paste:  https://atkxchsupdkwxtsjobti.supabase.co
```

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# paste:  the service-role key from step 1
```

```bash
npx wrangler secret put MCP_API_KEY
# paste:  any long random string. macOS:  openssl rand -hex 24
#         Windows PowerShell: [guid]::NewGuid().ToString()+[guid]::NewGuid()
#         Or just bash on your laptop your forehead and send a long alphanumeric.
# Save this value somewhere — you'll paste it into Claude in step 6.
```

### 5. Deploy

```bash
npx wrangler deploy
```

Output ends with a URL like:
```
https://sdluxury-mcp.<your-account>.workers.dev
```

Verify it's alive:
```bash
curl https://sdluxury-mcp.<your-account>.workers.dev/health
# {"ok":true,"service":"sdluxury-mcp"}
```

### 6. Add to Claude.ai as a Custom Connector

1. Open <https://claude.ai/settings/connectors> (or **Settings → Connectors**).
2. Click **Add custom connector**.
3. Fill in:
   - **Name:** `SDLuxury Ops`
   - **Server URL:** `https://sdluxury-mcp.<your-account>.workers.dev/mcp`
   - **Authentication:** Custom headers
   - **Header name:** `Authorization`
   - **Header value:** `Bearer <the MCP_API_KEY you set in step 4>`
4. Save. Claude will probe the connector — you should see the 7 tools listed.

### 7. Use it

Open a regular Claude.ai chat (or, ideally, your **SDLuxury Operations**
project). Make sure the **SDLuxury Ops** connector is enabled in the chat
(the connector picker is the small icon near the message input).

Try:
> *Create a ride for Kevin Morgan, LAX → Beverly Hilton, tomorrow 7:15 AM,
> Greg driving the Yukon, $285 fare with 20% gratuity.*

Claude will call `create_ride` and tell you the ride was added. Refresh your
dashboard at `https://claudeapps-1.gregecom11.workers.dev/` — it's there.

---

## Re-deploying after code changes

```bash
cd mcp-server
npm install
npx wrangler deploy
```

The URL stays the same. No need to update Claude.

## Rotating the API key

```bash
npx wrangler secret put MCP_API_KEY
# paste new value
```

Then update the **Authorization** header in Claude → Settings → Connectors.

## Troubleshooting

- **Claude says "tool failed: 401 unauthorized"** — the `Authorization` header
  doesn't match. Re-paste it as `Bearer <key>` (the word "Bearer" + space + key).
- **Claude says "tool failed: 503"** — secrets aren't set. Re-run `wrangler secret put`.
- **Rides don't appear on dashboard** — RLS may be blocking your read. Make sure
  your owner row exists (`update public.profiles set role = 'owner' where ...`).
