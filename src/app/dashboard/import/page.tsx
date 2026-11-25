import { requireRestaurant } from "@/features/auth/session";
import { isAiConfigured } from "@/features/ai/gateway";
import { MenuImporter } from "@/features/ai/MenuImporter";
import { Card, PageHeader } from "@/features/dashboard/ui";

/** Import a paper menu with AI (photos or PDF → categories, dishes, prices). */
export default async function ImportPage() {
  const restaurant = await requireRestaurant();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Importer votre menu avec l'IA"
        description="Photographiez votre carte papier : l'IA lit les catégories, les plats, les descriptions et les prix. Vous vérifiez avant d'importer."
      />
      <Card>
        <MenuImporter currency={restaurant.currency} aiReady={isAiConfigured()} />
      </Card>
    </div>
  );
}
