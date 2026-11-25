"use server";

import { redirect } from "next/navigation";
import { authorize } from "@/features/auth/session";
import { isImage } from "@/features/media/images";
import { processPhoto } from "@/features/media/photos";
import { MEDIA_BUCKET, UPLOADS_BUCKET, mediaPaths } from "@/features/media/urls";
import type { StoredPhoto } from "@/features/menu/types";
import { DISH_TAGS, parsePriceToCents, setLocalized, text, type FormState } from "../form-utils";
import { menuChanged } from "../revalidate";

const YEAR = "31536000";

export async function saveDish(dishId: string, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase, restaurant } = await authorize();
  const { data: dish } = await supabase.from("dishes").select("name, description").eq("id", dishId).eq("restaurant_id", restaurant.id).maybeSingle();
  if (!dish) return { error: "Plat introuvable." };

  const name = text(formData, "name", 120);
  if (!name) return { error: "Le nom du plat est obligatoire." };
  const price = parsePriceToCents(text(formData, "price", 20));
  if (price === undefined) return { error: "Prix invalide. Exemple : 13,50" };

  const categoryId = text(formData, "category_id") || null;
  if (categoryId) {
    // The category must belong to the same restaurant (the database only checks it exists).
    const { data: category } = await supabase.from("categories").select("id").eq("id", categoryId).eq("restaurant_id", restaurant.id).maybeSingle();
    if (!category) return { error: "Catégorie invalide." };
  }
  const tags = formData.getAll("tags").map(String).filter((t) => (DISH_TAGS as readonly string[]).includes(t));
  const locale = restaurant.default_locale;

  const { error } = await supabase
    .from("dishes")
    .update({
      name: setLocalized(dish.name, locale, name),
      description: setLocalized(dish.description, locale, text(formData, "description", 600)),
      price_cents: price,
      category_id: categoryId,
      tags,
      is_available: formData.get("is_available") === "on",
    })
    .eq("id", dishId);
  if (error) return { error: "Enregistrement impossible. Réessayez." };
  menuChanged(restaurant.slug);
  return { success: "Plat enregistré." };
}

export async function deleteDish(dishId: string): Promise<void> {
  const { supabase, restaurant } = await authorize();
  const { data: dish } = await supabase.from("dishes").select("photo").eq("id", dishId).eq("restaurant_id", restaurant.id).maybeSingle();
  if (!dish) redirect("/dashboard/menu");

  // Clean up the dish's files (best effort: the row deletion is what matters).
  const { data: models } = await supabase.from("dish_models").select("glb_path, usdz_path, raw_path").eq("dish_id", dishId);
  const media = [dish.photo?.sm, dish.photo?.lg, ...(models ?? []).flatMap((m) => [m.glb_path, m.usdz_path])].filter(Boolean) as string[];
  const raws = (models ?? []).map((m) => m.raw_path).filter(Boolean) as string[];
  await Promise.all([
    media.length ? supabase.storage.from(MEDIA_BUCKET).remove(media) : null,
    raws.length ? supabase.storage.from(UPLOADS_BUCKET).remove(raws) : null,
  ]);

  await supabase.from("dishes").delete().eq("id", dishId);
  menuChanged(restaurant.slug);
  redirect("/dashboard/menu");
}

/**
 * Receives a photo already downscaled by the browser (fast upload on 4G),
 * then makes the final variants (480 / 1200 px WebP + blurred placeholder).
 */
export async function uploadDishPhoto(dishId: string, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase, restaurant } = await authorize();
  const { data: dish } = await supabase.from("dishes").select("photo").eq("id", dishId).eq("restaurant_id", restaurant.id).maybeSingle();
  if (!dish) return { error: "Plat introuvable." };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez une photo." };
  if (file.size > 4 * 1024 * 1024) return { error: "Photo trop lourde (4 Mo maximum)." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!(await isImage(bytes))) return { error: "Ce fichier n'est pas une image lisible (JPEG, PNG, WebP ou HEIC converti)." };

  const photo = await processPhoto(bytes);
  const sm = mediaPaths.dishPhoto(restaurant.id, dishId, photo.hash, "sm");
  const lg = mediaPaths.dishPhoto(restaurant.id, dishId, photo.hash, "lg");
  const uploads = await Promise.all([
    supabase.storage.from(MEDIA_BUCKET).upload(sm, photo.sm, { contentType: "image/webp", cacheControl: YEAR, upsert: true }),
    supabase.storage.from(MEDIA_BUCKET).upload(lg, photo.lg, { contentType: "image/webp", cacheControl: YEAR, upsert: true }),
  ]);
  if (uploads.some((u) => u.error)) return { error: "Envoi de la photo impossible. Réessayez." };

  const stored: StoredPhoto = { sm, lg, blur: photo.blurDataUrl, width: photo.width, height: photo.height };
  await supabase.from("dishes").update({ photo: stored }).eq("id", dishId);
  const old = dish.photo as StoredPhoto | null;
  if (old && old.sm !== sm) await supabase.storage.from(MEDIA_BUCKET).remove([old.sm, old.lg]);
  menuChanged(restaurant.slug);
  return { success: "Photo mise à jour." };
}

export async function removeDishPhoto(dishId: string): Promise<void> {
  const { supabase, restaurant } = await authorize();
  const { data: dish } = await supabase.from("dishes").select("photo").eq("id", dishId).eq("restaurant_id", restaurant.id).maybeSingle();
  const old = dish?.photo as StoredPhoto | null;
  if (!old) return;
  await supabase.from("dishes").update({ photo: null }).eq("id", dishId);
  await supabase.storage.from(MEDIA_BUCKET).remove([old.sm, old.lg]);
  menuChanged(restaurant.slug);
}
