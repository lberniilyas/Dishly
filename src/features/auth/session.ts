import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * DATA ACCESS LAYER for the owner side.
 * Every dashboard page and every Server Action starts here: it reads and
 * VERIFIES the session (getClaims checks the token's signature), then finds
 * the owner's restaurant. `cache()` dedupes these lookups within a request.
 */

export interface Owner {
  id: string;
  email: string | null;
}

export interface OwnerRestaurant {
  id: string;
  slug: string;
  name: string;
  tagline: Record<string, string>;
  logo_path: string | null;
  brand_color: string;
  default_locale: string;
  enabled_locales: string[];
  currency: string;
  is_published: boolean;
  role: "owner" | "staff";
}

export const getOwner = cache(async (): Promise<Owner | null> => {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

export async function requireOwner(): Promise<Owner> {
  const owner = await getOwner();
  if (!owner) redirect("/login");
  return owner;
}

/** The owner's restaurant (one per account for now; the schema allows more). */
export const getMyRestaurant = cache(async (): Promise<OwnerRestaurant | null> => {
  const owner = await requireOwner();
  const supabase = await createServerSupabase();
  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("user_id", owner.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) return null;
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, slug, name, tagline, logo_path, brand_color, default_locale, enabled_locales, currency, is_published")
    .eq("id", membership.restaurant_id)
    .single();
  return restaurant ? { ...restaurant, role: membership.role } : null;
});

/** For pages that need a restaurant: sends new owners to onboarding. */
export async function requireRestaurant(): Promise<OwnerRestaurant> {
  const restaurant = await getMyRestaurant();
  if (!restaurant) redirect("/dashboard/onboarding");
  return restaurant;
}

/**
 * Everything a Server Action needs: a Supabase client acting as the owner
 * (RLS enforced) and their restaurant. Actions must call this themselves —
 * never trust ids sent by the browser without it.
 */
export async function authorize() {
  const restaurant = await requireRestaurant();
  const supabase = await createServerSupabase();
  return { supabase, restaurant };
}
