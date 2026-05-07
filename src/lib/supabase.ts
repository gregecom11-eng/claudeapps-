import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The Supabase URL + anon ("publishable") key are public by design —
// Supabase enforces access via Row Level Security, not by hiding the key.
// We default to the project's public credentials and let build-time env
// vars override (useful if you ever swap Supabase projects).
const DEFAULT_URL = "https://atkxchsupdkwxtsjobti.supabase.co";
const DEFAULT_ANON_KEY = "sb_publishable_MJEC7RPHcziOTqwGIkKMTg_wfobwZll";

const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_URL;
const anon =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  DEFAULT_ANON_KEY;

export const supabase: SupabaseClient = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const isConfigured = Boolean(url && anon);
