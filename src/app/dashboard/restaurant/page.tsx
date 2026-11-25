import { requireRestaurant } from "@/features/auth/session";
import { LogoUploader } from "@/features/dashboard/LogoUploader";
import { RestaurantForm } from "@/features/dashboard/RestaurantForm";
import { Card, PageHeader } from "@/features/dashboard/ui";
import { localized } from "@/features/i18n";
import { publicMediaUrl } from "@/features/media/urls";

export default async function RestaurantSettingsPage() {
  const restaurant = await requireRestaurant();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Restaurant" description="Nom, adresse du menu, couleur et logo." />
      <div className="grid gap-5">
        <Card title="Logo" description="Affiché en haut de votre menu.">
          <LogoUploader logoUrl={restaurant.logo_path ? publicMediaUrl(restaurant.logo_path) : null} />
        </Card>
        <Card title="Informations">
          <RestaurantForm
            mode="edit"
            initial={{
              name: restaurant.name,
              slug: restaurant.slug,
              tagline: localized(restaurant.tagline, restaurant.default_locale),
              brand_color: restaurant.brand_color,
              currency: restaurant.currency,
            }}
          />
        </Card>
      </div>
    </div>
  );
}
