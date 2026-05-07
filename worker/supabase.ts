import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "./index";

// Service-role client. Bypasses RLS — only used by the worker, never reaches
// the browser. Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from Cloudflare
// secrets.
export function adminClient(env: Env): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Server is missing Supabase secrets. Set SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY in Cloudflare dashboard → Settings → " +
        "Variables and Secrets.",
    );
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
