import { DEFAULT_LOCALE, intlLocale, type Locale } from "./config";
import { fr, type Dictionary } from "./dictionaries/fr";

export * from "./config";
export type { Dictionary };

/** Text stored per language in the database, e.g. {"fr": "Croissant", "en": "Croissant"}. */
export type LocalizedText = Partial<Record<string, string>>;

const dictionaries: Record<Locale, Dictionary> = {
  fr,
  // Phase 3: add real translations. Falling back to French keeps the app working meanwhile.
  en: fr,
  ar: fr,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

/** Picks the text for `locale`, falling back to the restaurant's default language, then any value. */
export function localized(text: LocalizedText | null | undefined, locale: string, fallbackLocale: string = DEFAULT_LOCALE): string {
  if (!text) return "";
  return text[locale] || text[fallbackLocale] || Object.values(text).find(Boolean) || "";
}

export function formatPrice(cents: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency }).format(cents / 100);
}

/** "27" or "22,5" — sizes shown to diners. */
export function formatCm(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 }).format(value);
}
