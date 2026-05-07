import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "./index";

// Service-role client. Bypasses RLS — only used server-side, never exposed.
export function adminClient(env: Env): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set as Wrangler secrets.",
    );
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
