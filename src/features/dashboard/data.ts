import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { publicMediaUrl } from "@/features/media/urls";
import type { StoredPhoto } from "@/features/menu/types";

/**
 * Read queries for the dashboard. They run as the signed-in owner, so Row
 * Level Security guarantees they only ever see that owner's restaurant.
 */

export interface EditableDish {
  id: string;
  category_id: string | null;
  name: Record<string, string>;
  description: Record<string, string>;
  price_cents: number | null;
  photo: StoredPhoto | null;
  photoUrl: string | null;
  tags: string[];
  position: number;
  is_available: boolean;
  active_model_id: string | null;
}

export interface EditableCategory {
  id: string;
  name: Record<string, string>;
  position: number;
  is_visible: boolean;
}

export interface ModelVersion {
  id: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  source: string;
  glbUrl: string | null;
  usdzUrl: string | null;
  usdz_origin: string | null;
  raw_path: string | null;
  target_size_cm: number | null;
  size_cm: { x: number; y: number; z: number } | null;
  original_bytes: number | null;
  glb_bytes: number | null;
  usdz_bytes: number | null;
  triangle_count: number | null;
  warnings: string[];
  error: string | null;
  created_at: string;
}

const DISH_COLUMNS = "id, category_id, name, description, price_cents, photo, tags, position, is_available, active_model_id";

function withPhotoUrl<T extends { photo: StoredPhoto | null }>(row: T): T & { photoUrl: string | null } {
  return { ...row, photoUrl: row.photo ? publicMediaUrl(row.photo.sm) : null };
}

export async function getMenuForEditing(restaurantId: string) {
  const supabase = await createServerSupabase();
  const [categories, dishes] = await Promise.all([
    supabase.from("categories").select("id, name, position, is_visible").eq("restaurant_id", restaurantId).order("position"),
    supabase.from("dishes").select(DISH_COLUMNS).eq("restaurant_id", restaurantId).order("position"),
  ]);
  if (categories.error) throw new Error(categories.error.message);
  if (dishes.error) throw new Error(dishes.error.message);
  return {
    categories: categories.data as EditableCategory[],
    dishes: (dishes.data as Omit<EditableDish, "photoUrl">[]).map(withPhotoUrl),
  };
}

export async function getDishForEditing(restaurantId: string, dishId: string) {
  const supabase = await createServerSupabase();
  const [dish, categories, models] = await Promise.all([
    supabase.from("dishes").select(DISH_COLUMNS).eq("restaurant_id", restaurantId).eq("id", dishId).maybeSingle(),
    supabase.from("categories").select("id, name, position, is_visible").eq("restaurant_id", restaurantId).order("position"),
    supabase
      .from("dish_models")
      .select("id, status, source, glb_path, usdz_path, usdz_origin, raw_path, target_size_cm, size_cm, original_bytes, glb_bytes, usdz_bytes, triangle_count, warnings, error, created_at")
      .eq("dish_id", dishId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  if (!dish.data) return null;
  return {
    dish: withPhotoUrl(dish.data as Omit<EditableDish, "photoUrl">),
    categories: (categories.data ?? []) as EditableCategory[],
    models: (models.data ?? []).map(
      (m): ModelVersion => ({
        ...m,
        target_size_cm: m.target_size_cm == null ? null : Number(m.target_size_cm),
        glbUrl: m.glb_path ? publicMediaUrl(m.glb_path) : null,
        usdzUrl: m.usdz_path ? publicMediaUrl(m.usdz_path) : null,
      }),
    ),
  };
}

/** Counts for the overview page (last 7 days). Full stats come in phase 3. */
export async function getOverviewStats(restaurantId: string) {
  const supabase = await createServerSupabase();
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const count = async (type: string) => {
    const { count } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("type", type)
      .gte("created_at", since);
    return count ?? 0;
  };
  const [menuViews, dishViews, modelLoads, arLaunches] = await Promise.all([count("menu_view"), count("dish_view"), count("model_loaded"), count("ar_launch")]);
  return { menuViews, dishViews, modelLoads, arLaunches };
}
