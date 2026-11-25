"use server";

import { authorize } from "@/features/auth/session";
import { MEDIA_BUCKET, UPLOADS_BUCKET } from "@/features/media/urls";
import { menuChanged } from "../revalidate";

/** Makes a processed model version the one diners see. */
export async function publishModel(dishId: string, modelId: string): Promise<{ error?: string }> {
  const { supabase, restaurant } = await authorize();
  const { data: model } = await supabase
    .from("dish_models")
    .select("id, status")
    .eq("id", modelId)
    .eq("dish_id", dishId)
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();
  if (!model || model.status !== "ready") return { error: "Cette version n'est pas prête." };
  await supabase.from("dishes").update({ active_model_id: modelId }).eq("id", dishId).eq("restaurant_id", restaurant.id);
  menuChanged(restaurant.slug);
  return {};
}

/** Removes the 3D view from the public menu (versions are kept). */
export async function unpublishModel(dishId: string): Promise<void> {
  const { supabase, restaurant } = await authorize();
  await supabase.from("dishes").update({ active_model_id: null }).eq("id", dishId).eq("restaurant_id", restaurant.id);
  menuChanged(restaurant.slug);
}

/** Deletes a version that isn't published, and its files. */
export async function deleteModelVersion(dishId: string, modelId: string): Promise<{ error?: string }> {
  const { supabase, restaurant } = await authorize();
  const { data: dish } = await supabase.from("dishes").select("active_model_id").eq("id", dishId).eq("restaurant_id", restaurant.id).maybeSingle();
  if (!dish) return { error: "Plat introuvable." };
  if (dish.active_model_id === modelId) return { error: "Retirez d'abord cette version du menu." };
  const { data: model } = await supabase.from("dish_models").select("glb_path, usdz_path, raw_path").eq("id", modelId).eq("dish_id", dishId).maybeSingle();
  if (!model) return {};
  // The raw upload may be shared by several versions (resizing re-uses it).
  const { count } = await supabase.from("dish_models").select("id", { count: "exact", head: true }).eq("raw_path", model.raw_path ?? "").neq("id", modelId);
  await supabase.from("dish_models").delete().eq("id", modelId);
  const media = [model.glb_path, model.usdz_path].filter(Boolean) as string[];
  if (media.length) await supabase.storage.from(MEDIA_BUCKET).remove(media);
  if (model.raw_path && !count) await supabase.storage.from(UPLOADS_BUCKET).remove([model.raw_path]);
  menuChanged(restaurant.slug);
  return {};
}
