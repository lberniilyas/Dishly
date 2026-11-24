import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { publicMediaUrl } from "@/features/media/urls";
import type { PublicDish, PublicMenu, StoredPhoto } from "./types";

/**
 * Cache tag of a restaurant's public menu. The dashboard (phase 2) calls
 * revalidateTag(menuCacheTag(slug)) after every edit so diners see changes
 * right away; otherwise the cached menu is reused for every scan.
 */
export function menuCacheTag(slug: string): string {
  return `menu:${slug}`;
}

/**
 * Loads a published menu. Cached with `'use cache'`: Supabase is queried once,
 * then every diner gets the stored result (the page is served as static HTML).
 * Returns null when the slug doesn't exist or isn't published.
 */
export async function getPublicMenu(slug: string): Promise<PublicMenu | null> {
  "use cache";
  cacheTag(menuCacheTag(slug));
  // Safety net: even without an explicit refresh, changes appear within an hour.
  cacheLife("hours");

  const supabase = createPublicClient();
  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select("id, slug, name, tagline, logo_path, brand_color, default_locale, enabled_locales, currency")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw new Error(`Menu query failed: ${error.message}`);
  if (!restaurant) return null;

  const [categoriesResult, dishesResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, position")
      .eq("restaurant_id", restaurant.id)
      .eq("is_visible", true)
      .order("position", { ascending: true }),
    supabase
      .from("dishes")
      .select("id, category_id, name, description, price_cents, photo, tags, position, active_model_id")
      .eq("restaurant_id", restaurant.id)
      .eq("is_available", true)
      .order("position", { ascending: true }),
  ]);
  if (categoriesResult.error) throw new Error(categoriesResult.error.message);
  if (dishesResult.error) throw new Error(dishesResult.error.message);

  const modelIds = dishesResult.data.map((d) => d.active_model_id).filter((id): id is string => Boolean(id));
  const models = new Map<string, PublicDish["model"]>();
  if (modelIds.length > 0) {
    const { data, error: modelsError } = await supabase
      .from("dish_models")
      .select("id, glb_path, usdz_path, poster_path, size_cm")
      .in("id", modelIds)
      .eq("status", "ready");
    if (modelsError) throw new Error(modelsError.message);
    for (const m of data) {
      if (!m.glb_path) continue;
      const size = m.size_cm as { x: number; z: number } | null;
      models.set(m.id, {
        id: m.id,
        glbUrl: publicMediaUrl(m.glb_path),
        usdzUrl: m.usdz_path ? publicMediaUrl(m.usdz_path) : null,
        posterUrl: m.poster_path ? publicMediaUrl(m.poster_path) : null,
        footprintCm: size ? Math.max(size.x, size.z) : null,
      });
    }
  }

  const categories = categoriesResult.data.map((c) => ({
    id: c.id as string,
    name: c.name,
    dishes: dishesResult.data
      .filter((d) => d.category_id === c.id)
      .map((d): PublicDish => {
        const photo = d.photo as StoredPhoto | null;
        return {
          id: d.id,
          name: d.name,
          description: d.description ?? {},
          priceCents: d.price_cents,
          tags: d.tags ?? [],
          photo: photo
            ? { smUrl: publicMediaUrl(photo.sm), lgUrl: publicMediaUrl(photo.lg), blurDataUrl: photo.blur, width: photo.width, height: photo.height }
            : null,
          model: d.active_model_id ? (models.get(d.active_model_id) ?? null) : null,
        };
      }),
  }));

  return {
    restaurant: {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      tagline: restaurant.tagline ?? {},
      logoUrl: restaurant.logo_path ? publicMediaUrl(restaurant.logo_path) : null,
      brandColor: restaurant.brand_color,
      defaultLocale: restaurant.default_locale,
      enabledLocales: restaurant.enabled_locales,
      currency: restaurant.currency,
    },
    // Hide empty categories from diners.
    categories: categories.filter((c) => c.dishes.length > 0),
  };
}

/**
 * Params prerendered at build time. With Cache Components, a dynamic route
 * must list at least one value, so we fall back to the demo restaurant.
 * Restaurants created later are rendered on their first visit, then cached.
 */
export const DEMO_SLUG = "bistrot-demo";

export async function listPrerenderedMenus(): Promise<{ slug: string; dishIds: string[] }[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("restaurants").select("id, slug").eq("is_published", true).limit(50);
  if (error || !data || data.length === 0) return [{ slug: DEMO_SLUG, dishIds: [] }];

  const { data: dishes } = await supabase
    .from("dishes")
    .select("id, restaurant_id")
    .in("restaurant_id", data.map((r) => r.id))
    .eq("is_available", true)
    .limit(500);
  return data.map((r) => ({
    slug: r.slug,
    dishIds: (dishes ?? []).filter((d) => d.restaurant_id === r.id).map((d) => d.id),
  }));
}
