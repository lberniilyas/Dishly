/**
 * Reads Supabase settings from environment variables, with clear errors.
 *
 * Supabase has two kinds of keys:
 *  - publishable key (sb_publishable_…, formerly "anon"): safe in the browser,
 *    every request is filtered by Row Level Security.
 *  - secret key (sb_secret_…, formerly "service_role"): bypasses RLS. Server
 *    only — never import a file using it from a Client Component.
 *
 * NEXT_PUBLIC_* variables must be read with their literal name so Next.js can
 * inline them at build time.
 */

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in (see README).`);
  }
  return value;
}

export function getSupabaseUrl(): string {
  return required(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
}

export function getSupabasePublishableKey(): string {
  return required(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );
}

export function getSupabaseSecretKey(): string {
  return required(
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SECRET_KEY",
  );
}
