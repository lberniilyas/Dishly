import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRestaurant } from "@/features/auth/session";
import { getDishForEditing } from "@/features/dashboard/data";
import { DeleteDishButton } from "@/features/dashboard/dish/DeleteDishButton";
import { DishForm } from "@/features/dashboard/dish/DishForm";
import { ModelManager } from "@/features/dashboard/dish/ModelManager";
import { PhotoUploader } from "@/features/dashboard/dish/PhotoUploader";
import { centsToInput } from "@/features/dashboard/form-utils";
import { Badge, Card, Notice, PageHeader, buttonClass } from "@/features/dashboard/ui";
import { localized } from "@/features/i18n";
import { publicMediaUrl } from "@/features/media/urls";

export default async function DishEditorPage({ params }: PageProps<"/dashboard/dishes/[dishId]">) {
  const { dishId } = await params;
  const restaurant = await requireRestaurant();
  const data = await getDishForEditing(restaurant.id, dishId);
  if (!data) notFound();

  const { dish, categories, models } = data;
  const locale = restaurant.default_locale;
  const name = localized(dish.name, locale);

  return (
    <>
      <Link href="/dashboard/menu" className="mb-4 inline-block text-sm font-semibold text-muted hover:text-ink">
        ← Menu
      </Link>
      <PageHeader
        title={name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {dish.is_available ? <Badge tone="good">Visible</Badge> : <Badge tone="warn">Masqué</Badge>}
            {dish.active_model_id ? <Badge tone="brand">3D en ligne</Badge> : null}
          </span>
        }
        actions={
          dish.is_available && restaurant.is_published ? (
            <a href={`/r/${restaurant.slug}/d/${dish.id}`} target="_blank" rel="noreferrer" className={buttonClass.secondary}>
              Voir sur le menu ↗
            </a>
          ) : null
        }
      />

      {!dish.is_available ? (
        <div className="mb-5">
          <Notice tone="info">Ce plat est masqué. Quand il est prêt, cochez « Afficher sur le menu » puis enregistrez.</Notice>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Informations">
          <DishForm
            dishId={dish.id}
            currency={restaurant.currency}
            categories={categories.map((c) => ({ id: c.id, name: localized(c.name, locale) }))}
            initial={{
              name,
              description: localized(dish.description, locale),
              price: centsToInput(dish.price_cents),
              categoryId: dish.category_id,
              tags: dish.tags,
              isAvailable: dish.is_available,
            }}
          />
        </Card>
        <Card title="Photo">
          <PhotoUploader dishId={dish.id} photoUrl={dish.photo ? publicMediaUrl(dish.photo.lg) : null} />
        </Card>
      </div>

      <Card title="Modèle 3D & réalité augmentée" className="mt-5">
        <ModelManager
          dishId={dish.id}
          restaurantId={restaurant.id}
          activeModelId={dish.active_model_id}
          models={models}
          posterUrl={dish.photo ? publicMediaUrl(dish.photo.lg) : null}
        />
      </Card>

      <div className="mt-8 flex justify-end">
        <DeleteDishButton dishId={dish.id} name={name} />
      </div>
    </>
  );
}
