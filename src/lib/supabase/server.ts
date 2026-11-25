import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Supabase client acting AS the signed-in owner (session read from cookies).
 * Every query goes through Row Level Security, so an owner can only ever
 * read/write their own restaurant — even if our code had a bug.
 *
 * Use in Server Components, Server Actions and Route Handlers.
 * Create one per request (never share it between requests).
 */
export async function createServerSupabase() {
  // The Supabase auth client checks token expiry with Date.now() as soon as it
  // starts. Owner pages are per-request anyway, so tell Next.js to stop any
  // prerendering here (otherwise Cache Components rejects the clock read).
  await connection();
  const cookieStore = await cookies();
  return createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore: the proxy (src/proxy.ts) refreshes the session.
        }
      },
    },
  });
}
