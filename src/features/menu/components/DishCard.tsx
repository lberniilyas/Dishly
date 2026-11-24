import Link from "next/link";
import { formatPrice, getDictionary, localized, type Locale } from "@/features/i18n";
import type { PublicDish } from "../types";
import { DishPhoto } from "./DishPhoto";

interface Props {
  dish: PublicDish;
  slug: string;
  locale: Locale;
  fallbackLocale: string;
  currency: string;
  /** First photos on screen load eagerly (they're visible immediately). */
  priority?: boolean;
}

export function DishCard({ dish, slug, locale, fallbackLocale, currency, priority }: Props) {
  const t = getDictionary(locale);
  const name = localized(dish.name, locale, fallbackLocale);
  const description = localized(dish.description, locale, fallbackLocale);
  const has3d = Boolean(dish.model);

  const card = (
    <article className="flex gap-4 py-4">
      <div className="min-w-0 flex-1">
        <h3 className="text-[17px] leading-snug font-semibold text-ink">{name}</h3>
        {description ? <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{description}</p> : null}
        {dish.tags.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {dish.tags.map((tag) => (
              <li key={tag} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line">
                {t.tags[tag] ?? tag}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {dish.priceCents != null ? <span className="font-semibold text-ink">{formatPrice(dish.priceCents, currency, locale)}</span> : null}
          {has3d ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
              <CubeIcon />
              {t.menu.view3d}
            </span>
          ) : null}
        </div>
      </div>

      {dish.photo ? (
        <div className="relative size-28 shrink-0 overflow-hidden rounded-2xl bg-line">
          <DishPhoto photo={dish.photo} alt={name} sizes="112px" priority={priority} className="h-full w-full" />
          {has3d ? (
            <span className="absolute start-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold tracking-wide text-brand-ink shadow-sm">
              {t.menu.badge3d}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );

  // Dishes with nothing more to show (no photo, no 3D) aren't links.
  if (!dish.photo && !dish.model) return card;

  return (
    <Link
      href={`/r/${slug}/d/${dish.id}`}
      // Fetch the dish page ahead of time so opening it is instant.
      prefetch={true}
      className="-mx-2 block rounded-2xl px-2 transition-colors active:bg-black/[0.04]"
    >
      {card}
    </Link>
  );
}

function CubeIcon() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </svg>
  );
}
