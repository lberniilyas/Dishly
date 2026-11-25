"use server";

import { redirect } from "next/navigation";
import { authorize, getMyRestaurant, requireOwner } from "@/features/auth/session";
import { isImage, processLogo } from "@/features/media/images";
import { MEDIA_BUCKET } from "@/features/media/urls";
import { createServerSupabase } from "@/lib/supabase/server";
import { COLOR_PATTERN, CURRENCIES, SLUG_PATTERN, setLocalized, slugify, text, type FormState } from "../form-utils";
import { menuChanged } from "../revalidate";

const YEAR = "31536000";

export async function createRestaurant(_: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  if (await getMyRestaurant()) redirect("/dashboard");

  const name = text(formData, "name", 80);
  const slug = slugify(text(formData, "slug") || name);
  const brandColor = text(formData, "brand_color") || "#B4532A";
  const currency = text(formData, "currency") || "EUR";
  if (!name) return { error: "Indiquez le nom du restaurant." };
  if (!SLUG_PATTERN.test(slug)) return { error: "Adresse du menu invalide : lettres, chiffres et tirets uniquement." };
  if (!COLOR_PATTERN.test(brandColor)) return { error: "Couleur invalide." };
  if (!(CURRENCIES as readonly string[]).includes(currency)) return { error: "Devise non prise en charge." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("restaurants").insert({
    name,
    slug,
    brand_color: brandColor,
    currency,
    tagline: setLocalized({}, "fr", text(formData, "tagline", 140)),
    default_locale: "fr",
    enabled_locales: ["fr"],
  });
  if (error) {
    if (error.code === "23505") return { error: `L'adresse « ${slug} » est déjà utilisée. Choisissez-en une autre.` };
    console.error("[createRestaurant]", error);
    return { error: "Création impossible pour le moment. Réessayez." };
  }
  redirect("/dashboard");
}

export async function updateRestaurant(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, restaurant } = await authorize();
  const name = text(formData, "name", 80);
  const slug = slugify(text(formData, "slug"));
  const brandColor = text(formData, "brand_color");
  const currency = text(formData, "currency");
  if (!name) return { error: "Le nom est obligatoire." };
  if (!SLUG_PATTERN.test(slug)) return { error: "Adresse du menu invalide : lettres, chiffres et tirets uniquement." };
  if (!COLOR_PATTERN.test(brandColor)) return { error: "Couleur invalide." };
  if (!(CURRENCIES as readonly string[]).includes(currency)) return { error: "Devise non prise en charge." };

  const { error } = await supabase
    .from("restaurants")
    .update({
      name,
      slug,
      brand_color: brandColor,
      currency,
      tagline: setLocalized(restaurant.tagline, restaurant.default_locale, text(formData, "tagline", 140)),
    })
    .eq("id", restaurant.id);
  if (error) {
    if (error.code === "23505") return { error: `L'adresse « ${slug} » est déjà utilisée.` };
    console.error("[updateRestaurant]", error);
    return { error: "Enregistrement impossible. Réessayez." };
  }
  menuChanged(restaurant.slug, slug);
  return { success: slug !== restaurant.slug ? "Enregistré. Attention : l'adresse a changé, réimprimez vos QR codes." : "Modifications enregistrées." };
}

export async function setPublished(published: boolean): Promise<void> {
  const { supabase, restaurant } = await authorize();
  await supabase.from("restaurants").update({ is_published: published }).eq("id", restaurant.id);
  menuChanged(restaurant.slug);
}

export async function uploadLogo(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, restaurant } = await authorize();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez une image." };
  if (file.size > 4 * 1024 * 1024) return { error: "Image trop lourde (4 Mo maximum)." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!(await isImage(bytes))) return { error: "Ce fichier n'est pas une image lisible." };

  const logo = await processLogo(bytes);
  const path = `${restaurant.id}/logo-${logo.hash}.webp`;
  const upload = await supabase.storage.from(MEDIA_BUCKET).upload(path, logo.data, { contentType: "image/webp", cacheControl: YEAR, upsert: true });
  if (upload.error) return { error: "Envoi du logo impossible." };

  await supabase.from("restaurants").update({ logo_path: path }).eq("id", restaurant.id);
  if (restaurant.logo_path && restaurant.logo_path !== path) await supabase.storage.from(MEDIA_BUCKET).remove([restaurant.logo_path]);
  menuChanged(restaurant.slug);
  return { success: "Logo mis à jour." };
}

export async function removeLogo(): Promise<void> {
  const { supabase, restaurant } = await authorize();
  if (!restaurant.logo_path) return;
  await supabase.from("restaurants").update({ logo_path: null }).eq("id", restaurant.id);
  await supabase.storage.from(MEDIA_BUCKET).remove([restaurant.logo_path]);
  menuChanged(restaurant.slug);
}
