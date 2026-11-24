import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { preconnect, preload } from "react-dom";
import { TrackView } from "@/features/analytics/TrackView";
import { DEFAULT_LOCALE, formatCm, formatPrice, getDictionary, isLocale, localized } from "@/features/i18n";
import { brandStyle } from "@/features/menu/brand";
import { DishPhoto } from "@/features/menu/components/DishPhoto";
import { DishSkeleton } from "@/features/menu/components/Skeletons";
import { getPublicMenu, listPrerenderedMenus } from "@/features/menu/queries";
import { DishViewer } from "@/features/viewer/DishViewer";
import { getSupabaseUrl } from "@/lib/supabase/env";

/**
 * DISH PAGE — /r/[slug]/d/[dishId]
 * Interactive 3D model + "Voir sur votre table" (AR). Reuses the cached menu
 * data, so it costs no extra database query.
 */

export async function generateStaticParams() {
  const menus = await listPrerenderedMenus();
  const params = menus.flatMap(({ slug, dishIds }) => dishIds.map((dishId) => ({ slug, dishId })));
  // Cache Components needs at least one entry; an unknown id simply renders the 404 page.
  return params.length > 0 ? params : [{ slug: menus[0].slug, dishId: "00000000-0000-4000-8000-000000000000" }];
}

async function findDish(slug: string, dishId: string) {
  const menu = await getPublicMenu(slug);
  if (!menu) return null;
  for (const category of menu.categories) {
    const dish = category.dishes.find((d) => d.id === dishId);
    if (dish) return { menu, dish };
  }
  return null;
}

export async function generateMetadata({ params }: PageProps<"/r/[slug]/d/[dishId]">): Promise<Metadata> {
  const { slug, dishId } = await params;
  const found = await findDish(slug, dishId);
  if (!found) return { title: "Plat introuvable" };
  const { menu, dish } = found;
  const fallback = menu.restaurant.defaultLocale;
  return {
    title: `${localized(dish.name, fallback)} — ${menu.restaurant.name}`,
    description: localized(dish.description, fallback) || undefined,
    openGraph: dish.photo ? { images: [dish.photo.lgUrl] } : undefined,
  };
}

export default function DishPage({ params }: PageProps<"/r/[slug]/d/[dishId]">) {
  return (
    <Suspense fallback={<DishSkeleton />}>
      <Dish params={params} />
    </Suspense>
  );
}

async function Dish({ params }: { params: PageProps<"/r/[slug]/d/[dishId]">["params"] }) {
  const { slug, dishId } = await params;
  const found = await findDish(slug, dishId);
  if (!found) notFound();

  const { menu, dish } = found;
  const { restaurant } = menu;
  const locale = isLocale(restaurant.defaultLocale) ? restaurant.defaultLocale : DEFAULT_LOCALE;
  const t = getDictionary(locale);
  const name = localized(dish.name, locale, restaurant.defaultLocale);
  const description = localized(dish.description, locale, restaurant.defaultLocale);

  preconnect(getSupabaseUrl());
  if (dish.model) {
    // Start downloading the 3D model and its decoder while the JavaScript
    // loads, instead of after (saves ~0.5–1 s on 4G).
    preload(dish.model.glbUrl, { as: "fetch", crossOrigin: "anonymous" });
    preload("/draco/draco_wasm_wrapper.js", { as: "fetch", crossOrigin: "anonymous" });
    preload("/draco/draco_decoder.wasm", { as: "fetch", crossOrigin: "anonymous" });
  }

  return (
    <main style={brandStyle(restaurant.brandColor)} className={dish.model ? "pb-32" : "pb-12"}>
      <TrackView type="dish_view" restaurantId={restaurant.id} dishId={dish.id} />

      <div className="relative">
        <Link
          href={`/r/${restaurant.slug}`}
          className="absolute start-4 top-[max(1rem,env(safe-area-inset-top))] z-10 inline-flex items-center gap-1 rounded-full bg-white/90 py-2 ps-3 pe-4 text-sm font-semibold text-ink shadow-sm backdrop-blur"
        >
          <span aria-hidden className="rtl:rotate-180">
            ←
          </span>
          {t.dish.back}
        </Link>

        {dish.model ? (
          <DishViewer restaurantId={restaurant.id} dishId={dish.id} dishName={name} model={dish.model} photo={dish.photo} locale={locale} />
        ) : dish.photo ? (
          <DishPhoto photo={dish.photo} alt={name} sizes="100vw" priority className="aspect-square max-h-[62svh] w-full" />
        ) : null}
      </div>

      <article className="mx-auto max-w-xl px-5 pt-6">
        <p className="text-sm font-medium text-muted">{restaurant.name}</p>
        <div className="mt-1 flex items-start justify-between gap-4">
          <h1 className="font-display text-[30px] leading-tight text-ink">{name}</h1>
          {dish.priceCents != null ? (
            <p className="shrink-0 pt-1.5 text-lg font-semibold text-ink">{formatPrice(dish.priceCents, restaurant.currency, locale)}</p>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {dish.model?.footprintCm ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              <RulerIcon />
              {t.dish.realSize(formatCm(dish.model.footprintCm, locale))}
            </span>
          ) : null}
          {dish.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-muted ring-1 ring-line">
              {t.tags[tag] ?? tag}
            </span>
          ))}
        </div>

        {description ? <p className="mt-4 text-[15px] leading-relaxed text-ink/80">{description}</p> : null}
      </article>
    </main>
  );
}

function RulerIcon() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17 17 3l4 4L7 21l-4-4Z" />
      <path d="m7.5 12.5 2 2M10.5 9.5l2 2M13.5 6.5l2 2" />
    </svg>
  );
}
