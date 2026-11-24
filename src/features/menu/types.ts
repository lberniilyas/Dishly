import type { LocalizedText } from "@/features/i18n";

/** Everything the public menu needs, already resolved to absolute URLs. */
export interface PublicMenu {
  restaurant: PublicRestaurant;
  categories: PublicCategory[];
}

export interface PublicRestaurant {
  id: string;
  slug: string;
  name: string;
  tagline: LocalizedText;
  logoUrl: string | null;
  brandColor: string;
  defaultLocale: string;
  enabledLocales: string[];
  currency: string;
}

export interface PublicCategory {
  id: string;
  name: LocalizedText;
  dishes: PublicDish[];
}

export interface PublicDish {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  priceCents: number | null;
  tags: string[];
  photo: PublicPhoto | null;
  model: PublicModel | null;
}

export interface PublicPhoto {
  smUrl: string;
  lgUrl: string;
  blurDataUrl: string;
  width: number;
  height: number;
}

export interface PublicModel {
  id: string;
  glbUrl: string;
  /** iPhone AR Quick Look file. null → model-viewer converts the .glb on the fly. */
  usdzUrl: string | null;
  posterUrl: string | null;
  /** Largest horizontal dimension in cm (plate diameter…), shown to diners. */
  footprintCm: number | null;
}

/** Shape of the `dishes.photo` jsonb column. */
export interface StoredPhoto {
  sm: string;
  lg: string;
  blur: string;
  width: number;
  height: number;
}
