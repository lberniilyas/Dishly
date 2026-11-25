"use server";

import { redirect } from "next/navigation";
import { authorize } from "@/features/auth/session";
import { setLocalized, text, type FormState } from "../form-utils";
import { menuChanged } from "../revalidate";

/* ------------------------------ Categories ------------------------------ */

export async function createCategory(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, restaurant } = await authorize();
  const name = text(formData, "name", 60);
  if (!name) return { error: "Donnez un nom à la catégorie." };
  const { data: last } = await supabase.from("categories").select("position").eq("restaurant_id", restaurant.id).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("categories").insert({
    restaurant_id: restaurant.id,
    name: setLocalized({}, restaurant.default_locale, name),
    position: (last?.position ?? -1) + 1,
  });
  if (error) return { error: "Création impossible. Réessayez." };
  menuChanged(restaurant.slug);
  return { success: `Catégorie « ${name} » ajoutée.` };
}

export async function renameCategory(categoryId: string, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase, restaurant } = await authorize();
  const name = text(formData, "name", 60);
  if (!name) return { error: "Le nom ne peut pas être vide." };
  const { data: category } = await supabase.from("categories").select("name").eq("id", categoryId).eq("restaurant_id", restaurant.id).maybeSingle();
  if (!category) return { error: "Catégorie introuvable." };
  await supabase.from("categories").update({ name: setLocalized(category.name, restaurant.default_locale, name) }).eq("id", categoryId);
  menuChanged(restaurant.slug);
  return { success: "Renommée." };
}

export async function toggleCategoryVisibility(categoryId: string, visible: boolean): Promise<void> {
  const { supabase, restaurant } = await authorize();
  await supabase.from("categories").update({ is_visible: visible }).eq("id", categoryId).eq("restaurant_id", restaurant.id);
  menuChanged(restaurant.slug);
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const { supabase, restaurant } = await authorize();
  // Dishes are kept (moved to "Sans catégorie" by the database).
  await supabase.from("categories").delete().eq("id", categoryId).eq("restaurant_id", restaurant.id);
  menuChanged(restaurant.slug);
}

export async function moveCategory(categoryId: string, direction: "up" | "down"): Promise<void> {
  const { supabase, restaurant } = await authorize();
  const { data } = await supabase.from("categories").select("id").eq("restaurant_id", restaurant.id).order("position");
  await reorder(data ?? [], categoryId, direction, (id, position) => supabase.from("categories").update({ position }).eq("id", id));
  menuChanged(restaurant.slug);
}

/* -------------------------------- Dishes -------------------------------- */

export async function createDish(categoryId: string | null): Promise<void> {
  const { supabase, restaurant } = await authorize();
  if (categoryId) {
    const { data: category } = await supabase.from("categories").select("id").eq("id", categoryId).eq("restaurant_id", restaurant.id).maybeSingle();
    if (!category) throw new Error("Catégorie introuvable.");
  }
  let query = supabase.from("dishes").select("position").eq("restaurant_id", restaurant.id);
  query = categoryId ? query.eq("category_id", categoryId) : query.is("category_id", null);
  const { data: last } = await query.order("position", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("dishes")
    .insert({
      restaurant_id: restaurant.id,
      category_id: categoryId,
      name: setLocalized({}, restaurant.default_locale, "Nouveau plat"),
      position: (last?.position ?? -1) + 1,
      // Hidden from diners until the owner has filled it in.
      is_available: false,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Création du plat impossible.");
  menuChanged(restaurant.slug);
  redirect(`/dashboard/dishes/${data.id}`);
}

export async function moveDish(dishId: string, direction: "up" | "down"): Promise<void> {
  const { supabase, restaurant } = await authorize();
  const { data: dish } = await supabase.from("dishes").select("category_id").eq("id", dishId).eq("restaurant_id", restaurant.id).maybeSingle();
  if (!dish) return;
  let query = supabase.from("dishes").select("id").eq("restaurant_id", restaurant.id);
  query = dish.category_id ? query.eq("category_id", dish.category_id) : query.is("category_id", null);
  const { data } = await query.order("position");
  await reorder(data ?? [], dishId, direction, (id, position) => supabase.from("dishes").update({ position }).eq("id", id));
  menuChanged(restaurant.slug);
}

export async function toggleDishAvailability(dishId: string, available: boolean): Promise<void> {
  const { supabase, restaurant } = await authorize();
  await supabase.from("dishes").update({ is_available: available }).eq("id", dishId).eq("restaurant_id", restaurant.id);
  menuChanged(restaurant.slug);
}

/** Swaps an item with its neighbour, then rewrites positions as 0, 1, 2… */
async function reorder(
  rows: { id: string }[],
  id: string,
  direction: "up" | "down",
  save: (id: string, position: number) => PromiseLike<unknown>,
) {
  const ids = rows.map((r) => r.id);
  const index = ids.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  await Promise.all(ids.map((rowId, position) => save(rowId, position)));
}
