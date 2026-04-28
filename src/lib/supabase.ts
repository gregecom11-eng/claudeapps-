import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  // Fail loudly in the dev console, but don't crash the page — the login
  // screen will tell the user what's missing.
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
  );
}

export const supabase: SupabaseClient = createClient(
  url ?? "https://missing.supabase.co",
  anon ?? "missing",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

export const isConfigured = Boolean(url && anon);
