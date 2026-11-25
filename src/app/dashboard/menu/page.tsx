import Link from "next/link";
import { requireRestaurant } from "@/features/auth/session";
import { createDish, moveCategory, moveDish, toggleCategoryVisibility, toggleDishAvailability } from "@/features/dashboard/actions/menu";
import { getMenuForEditing, type EditableDish } from "@/features/dashboard/data";
import { ActionButton, ActionIconButton, AddCategoryForm, CategoryTitle, DeleteCategoryButton } from "@/features/dashboard/menu-controls";
import { Badge, Card, PageHeader, buttonClass } from "@/features/dashboard/ui";
import { formatPrice, isLocale, localized, type Locale } from "@/features/i18n";

export default async function MenuPage() {
  const restaurant = await requireRestaurant();
  const { categories, dishes } = await getMenuForEditing(restaurant.id);
  const locale: Locale = isLocale(restaurant.default_locale) ? restaurant.default_locale : "fr";
  const uncategorized = dishes.filter((d) => !d.category_id || !categories.some((c) => c.id === d.category_id));

  return (
    <>
      <PageHeader
        title="Menu"
        description="Catégories et plats, dans l'ordre où vos clients les voient."
        actions={
          <Link href="/dashboard/import" className={buttonClass.secondary}>
            ✨ Importer avec l&apos;IA
          </Link>
        }
      />

      <div className="grid gap-5">
        {categories.length === 0 ? (
          <Card>
            <p className="font-semibold text-ink">Commencez par créer une catégorie</p>
            <p className="mt-1 mb-4 text-sm text-muted">Par exemple « Entrées », « Plats », « Desserts », « Boissons ». Ou importez votre carte papier avec l&apos;IA.</p>
            <AddCategoryForm />
          </Card>
        ) : null}

        {categories.map((category, index) => {
          const items = dishes.filter((d) => d.category_id === category.id);
          const name = localized(category.name, locale);
          return (
            <Card key={category.id}>
              <div className="flex flex-wrap items-center gap-2">
                <CategoryTitle id={category.id} name={name}>
                  {!category.is_visible ? <Badge tone="warn">Masquée</Badge> : null}
                </CategoryTitle>
                <div className="flex items-center gap-1.5">
                  <ActionIconButton label="Monter" action={moveCategory.bind(null, category.id, "up")} disabled={index === 0}>
                    ↑
                  </ActionIconButton>
                  <ActionIconButton label="Descendre" action={moveCategory.bind(null, category.id, "down")} disabled={index === categories.length - 1}>
                    ↓
                  </ActionIconButton>
                  <ActionButton action={toggleCategoryVisibility.bind(null, category.id, !category.is_visible)}>
                    {category.is_visible ? "Masquer" : "Afficher"}
                  </ActionButton>
                  <DeleteCategoryButton id={category.id} name={name} dishCount={items.length} />
                </div>
              </div>

              <DishList dishes={items} locale={locale} currency={restaurant.currency} />

              <form action={createDish.bind(null, category.id)} className="mt-4">
                <button type="submit" className={buttonClass.small}>
                  + Ajouter un plat
                </button>
              </form>
            </Card>
          );
        })}

        {uncategorized.length > 0 ? (
          <Card title="Sans catégorie" description="Ces plats ne s'affichent pas sur le menu tant qu'ils n'ont pas de catégorie.">
            <DishList dishes={uncategorized} locale={locale} currency={restaurant.currency} />
          </Card>
        ) : null}

        {categories.length > 0 ? (
          <Card title="Ajouter une catégorie">
            <AddCategoryForm />
          </Card>
        ) : null}
      </div>
    </>
  );
}

function DishList({ dishes, locale, currency }: { dishes: EditableDish[]; locale: Locale; currency: string }) {
  if (dishes.length === 0) return <p className="mt-4 text-sm text-muted">Aucun plat dans cette catégorie.</p>;
  return (
    <ul className="mt-4 divide-y divide-line">
      {dishes.map((dish, index) => (
        <li key={dish.id} className="flex items-center gap-3 py-3">
          <Link href={`/dashboard/dishes/${dish.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl hover:opacity-80">
            <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-[#f6f3ee] ring-1 ring-line">
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-resized thumbnail */}
              {dish.photoUrl ? <img src={dish.photoUrl} alt="" className="size-full object-cover" loading="lazy" /> : null}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{localized(dish.name, locale)}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                {dish.price_cents != null ? <span>{formatPrice(dish.price_cents, currency, locale)}</span> : <span>Sans prix</span>}
                {dish.active_model_id ? <Badge tone="brand">3D</Badge> : null}
                {!dish.is_available ? <Badge tone="warn">Masqué</Badge> : null}
              </div>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            <ActionIconButton label="Monter" action={moveDish.bind(null, dish.id, "up")} disabled={index === 0}>
              ↑
            </ActionIconButton>
            <ActionIconButton label="Descendre" action={moveDish.bind(null, dish.id, "down")} disabled={index === dishes.length - 1}>
              ↓
            </ActionIconButton>
            <ActionButton action={toggleDishAvailability.bind(null, dish.id, !dish.is_available)}>{dish.is_available ? "Masquer" : "Afficher"}</ActionButton>
          </div>
        </li>
      ))}
    </ul>
  );
}
