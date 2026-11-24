import { createClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Anonymous Supabase client for public data (published menus).
 *
 * It has no user session, so Row Level Security only lets it read what any
 * diner may see. Safe on the server and in the browser. No cookies are read,
 * which keeps menu pages cacheable.
 */
export function createPublicClient() {
  return createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
