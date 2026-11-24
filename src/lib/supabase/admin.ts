import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey, getSupabaseUrl } from "./env";

/**
 * Privileged Supabase client (secret key — bypasses Row Level Security).
 *
 * Server-only: the `server-only` import makes the build fail if a Client
 * Component ever imports this file, so the key can't leak to browsers.
 * Use it only for trusted server work (analytics inserts, model processing).
 */
export function createAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
