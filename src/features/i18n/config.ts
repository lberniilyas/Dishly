/**
 * Languages. Phase 1 ships French only, but everything is already shaped for
 * more: menu text is stored per language ({"fr": …, "en": …}) and layouts use
 * logical CSS (start/end instead of left/right) so Arabic (right-to-left)
 * works by flipping `dir` on <html>.
 */
export const SUPPORTED_LOCALES = ["fr", "en", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

const RTL_LOCALES: readonly Locale[] = ["ar"];

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function textDirection(locale: Locale): "ltr" | "rtl" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

/** BCP 47 tag used for number/price formatting. */
export function intlLocale(locale: Locale): string {
  return { fr: "fr-FR", en: "en-GB", ar: "ar-MA" }[locale];
}
