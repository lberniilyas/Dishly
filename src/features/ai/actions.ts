"use server";

import { z } from "zod";
import { authorize } from "@/features/auth/session";
import { DISH_TAGS, setLocalized } from "@/features/dashboard/form-utils";
import { menuChanged } from "@/features/dashboard/revalidate";
import { AiUnavailableError } from "./gateway";
import { extractMenu, type MenuDraft, type MenuSource } from "./menu-extraction";

const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // the browser shrinks photos first
const MAX_FILES = 6;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export type ExtractResult = { draft: MenuDraft } | { error: string };

/** Step 1: read the uploaded menu with AI and return a draft for review (nothing saved). */
export async function extractMenuAction(formData: FormData): Promise<ExtractResult> {
  await authorize();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Ajoutez au moins une photo ou un PDF de votre menu." };
  if (files.length > MAX_FILES) return { error: `${MAX_FILES} fichiers maximum par import.` };
  if (files.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_BYTES) return { error: "Fichiers trop lourds (4 Mo au total). Importez le menu en plusieurs fois." };
  if (files.some((f) => !(ACCEPTED as readonly string[]).includes(f.type))) return { error: "Formats acceptés : photos (JPEG, PNG, WebP) ou PDF." };

  const sources: MenuSource[] = await Promise.all(
    files.map(async (f) => ({ mediaType: f.type as MenuSource["mediaType"], data: new Uint8Array(await f.arrayBuffer()) })),
  );
  try {
    const draft = await extractMenu(sources);
    if (draft.categories.every((c) => c.dishes.length === 0)) return { error: "Aucun plat n'a été trouvé. Vérifiez que les photos montrent bien le menu." };
    return { draft };
  } catch (error) {
    if (error instanceof AiUnavailableError) return { error: error.message };
    console.error("[extractMenuAction]", error);
    return { error: "La lecture du menu a échoué. Réessayez." };
  }
}

const ImportSchema = z.object({
  categories: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        dishes: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(120),
              description: z.string().trim().max(600).nullable(),
              price_cents: z.number().int().min(0).max(10_000_000).nullable(),
              tags: z.array(z.enum(DISH_TAGS)),
            }),
          )
          .max(200),
      }),
    )
    .max(40),
});

export type ImportPayload = z.infer<typeof ImportSchema>;

/**
 * Step 2: save the dishes the owner kept. Sections are matched by name with
 * existing categories (so re-importing a page doesn't duplicate sections);
 * new dishes go at the end of their section.
 */
export async function importMenuDraft(payload: ImportPayload): Promise<{ error?: string; dishes?: number; categories?: number }> {
  const { supabase, restaurant } = await authorize();
  const parsed = ImportSchema.safeParse(payload);
  if (!parsed.success) return { error: "Données invalides. Vérifiez les noms et les prix." };
  const locale = restaurant.default_locale;

  const { data: existing } = await supabase.from("categories").select("id, name, position").eq("restaurant_id", restaurant.id).order("position");
  const byName = new Map((existing ?? []).map((c) => [normalize(c.name?.[locale] ?? Object.values(c.name ?? {})[0] ?? ""), c.id as string]));
  let nextCategoryPosition = (existing?.at(-1)?.position ?? -1) + 1;
  let createdCategories = 0;
  let createdDishes = 0;

  for (const category of parsed.data.categories) {
    if (category.dishes.length === 0) continue;
    let categoryId = byName.get(normalize(category.name));
    if (!categoryId) {
      const { data, error } = await supabase
        .from("categories")
        .insert({ restaurant_id: restaurant.id, name: setLocalized({}, locale, category.name), position: nextCategoryPosition++ })
        .select("id")
        .single();
      if (error || !data) return { error: "Import interrompu (catégorie). Réessayez." };
      categoryId = data.id as string;
      byName.set(normalize(category.name), categoryId);
      createdCategories++;
    }
    const { data: last } = await supabase.from("dishes").select("position").eq("category_id", categoryId).order("position", { ascending: false }).limit(1).maybeSingle();
    const start = (last?.position ?? -1) + 1;
    const { error } = await supabase.from("dishes").insert(
      category.dishes.map((dish, i) => ({
        restaurant_id: restaurant.id,
        category_id: categoryId,
        name: setLocalized({}, locale, dish.name),
        description: setLocalized({}, locale, dish.description ?? ""),
        price_cents: dish.price_cents,
        tags: dish.tags,
        position: start + i,
        is_available: true,
      })),
    );
    if (error) return { error: "Import interrompu (plats). Réessayez." };
    createdDishes += category.dishes.length;
  }

  menuChanged(restaurant.slug);
  return { dishes: createdDishes, categories: createdCategories };
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
