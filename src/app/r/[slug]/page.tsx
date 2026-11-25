import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { preconnect } from "react-dom";
import { TrackView } from "@/features/analytics/TrackView";
import { DEFAULT_LOCALE, getDictionary, isLocale, localized } from "@/features/i18n";
import { brandStyle } from "@/features/menu/brand";
import { CategoryNav } from "@/features/menu/components/CategoryNav";
import { DishCard } from "@/features/menu/components/DishCard";
import { MenuSkeleton } from "@/features/menu/components/Skeletons";
import { TableBadge } from "@/features/menu/components/TableBadge";
import { getPublicMenu, listPrerenderedMenus } from "@/features/menu/queries";
import { PreloadViewer } from "@/features/viewer/PreloadViewer";
import { getSupabaseUrl } from "@/lib/supabase/env";

/**
 * PUBLIC MENU — /r/[slug]   (what diners see after scanning the QR code)
 *
 * Rendered once, then served from cache to every diner: no database call per
 * scan. `?table=5` is read in the browser (TableBadge/analytics) so it
 * doesn't break caching.
 */

export async function generateStaticParams() {
  const menus = await listPrerenderedMenus();
  return menus.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/r/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const menu = await getPublicMenu(slug);
  if (!menu) return { title: "Menu introuvable" };
  const { restaurant } = menu;
  return {
    title: `${restaurant.name} — Menu`,
    description: localized(restaurant.tagline, restaurant.defaultLocale) || undefined,
  };
}

export default function MenuPage({ params }: PageProps<"/r/[slug]">) {
  return (
    <Suspense fallback={<MenuSkeleton />}>
      <Menu params={params} />
    </Suspense>
  );
}

async function Menu({ params }: { params: PageProps<"/r/[slug]">["params"] }) {
  const { slug } = await params;
  const menu = await getPublicMenu(slug);
  if (!menu) notFound();

  const { restaurant, categories } = menu;
  const locale = isLocale(restaurant.defaultLocale) ? restaurant.defaultLocale : DEFAULT_LOCALE;
  const t = getDictionary(locale);
  const tagline = localized(restaurant.tagline, locale, restaurant.defaultLocale);
  const has3d = categories.some((c) => c.dishes.some((d) => d.model));

  // Open the connection to the image CDN early (saves a round-trip on 4G).
  preconnect(getSupabaseUrl());

  let photoCount = 0; // the first few photos are above the fold: load them eagerly

  return (
    <main style={brandStyle(restaurant.brandColor)} className="pb-16">
      <TrackView type="menu_view" restaurantId={restaurant.id} />
      {has3d ? <PreloadViewer /> : null}

      <header className="mx-auto max-w-xl px-5 pt-[max(2.5rem,env(safe-area-inset-top))] pb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            {restaurant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- pre-resized logo
              <img src={restaurant.logoUrl} alt="" width={56} height={56} className="mb-3 size-14 rounded-2xl bg-white object-contain p-1.5 shadow-sm ring-1 ring-line" />
            ) : null}
            <h1 className="font-display text-[34px] leading-tight text-ink">{restaurant.name}</h1>
            {tagline ? <p className="mt-1 text-[15px] text-muted">{tagline}</p> : null}
          </div>
          <TableBadge locale={locale} />
        </div>

        {has3d ? (
          <p className="mt-5 flex items-center gap-3 rounded-2xl bg-brand px-4 py-3 text-sm font-medium text-brand-ink shadow-sm">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-white/20 text-xs font-bold">
              3D
            </span>
            {t.menu.banner}
          </p>
        ) : null}
      </header>

      <CategoryNav categories={categories.map((c) => ({ id: c.id, label: localized(c.name, locale, restaurant.defaultLocale) }))} />

      <div className="mx-auto max-w-xl px-5">
        {categories.length === 0 ? <p className="py-16 text-center text-muted">{t.menu.empty}</p> : null}
        {categories.map((category) => (
          <section key={category.id} id={`cat-${category.id}`} className="pt-7">
            <h2 className="font-display text-2xl text-ink">{localized(category.name, locale, restaurant.defaultLocale)}</h2>
            <div className="mt-1 divide-y divide-line">
              {category.dishes.map((dish) => (
                <DishCard
                  key={dish.id}
                  dish={dish}
                  slug={restaurant.slug}
                  locale={locale}
                  fallbackLocale={restaurant.defaultLocale}
                  currency={restaurant.currency}
                  priority={dish.photo ? photoCount++ < 3 : false}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="mx-auto mt-12 max-w-xl px-5 text-center text-xs text-muted">{t.menu.poweredBy}</footer>
    </main>
  );
}
