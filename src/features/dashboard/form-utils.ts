/** Helpers shared by the dashboard Server Actions (pure functions, no server-only imports). */

export interface FormState {
  error?: string;
  success?: string;
}

export function text(formData: FormData, name: string, max = 500): string {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

/**
 * "13,50", "13.5", "13,50 €", "€13.50" → 1350. Empty → null (price not shown).
 * Returns undefined when the input isn't a valid price.
 */
export function parsePriceToCents(input: string): number | null | undefined {
  const cleaned = input.replace(/[^\d,.\-]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") && !cleaned.includes(".") ? cleaned.replace(",", ".") : cleaned.replace(/,/g, "");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0 || value > 100000) return undefined;
  return Math.round(value * 100);
}

export function centsToInput(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** "Le Petit Bistrot!" → "le-petit-bistrot" (URL-safe, matches the DB check). */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/;
export const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
export const CURRENCIES = ["EUR", "MAD", "CHF", "GBP", "USD", "CAD", "XOF", "TND", "DZD", "AED"] as const;

/** Tag vocabulary (labels live in the i18n dictionary). */
export const DISH_TAGS = ["maison", "vegetarien", "vegan", "epice", "signature", "partage", "nouveau"] as const;

/** Updates one language inside a {"fr": …, "en": …} field without losing the others. */
export function setLocalized(existing: Record<string, string> | null | undefined, locale: string, value: string): Record<string, string> {
  const next = { ...(existing ?? {}) };
  if (value) next[locale] = value;
  else delete next[locale];
  return next;
}
