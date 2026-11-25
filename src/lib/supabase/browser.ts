"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components, using the owner's session cookie.
 * Used for direct-to-storage uploads (3D scans can be 50 MB: too big to pass
 * through our server). Row Level Security limits writes to the owner's own
 * restaurant folder.
 */
let client: ReturnType<typeof createBrowserClient> | null = null;

export function getBrowserSupabase() {
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
  return client;
}
