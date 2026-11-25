import { redirect } from "next/navigation";
import { getMyRestaurant } from "@/features/auth/session";
import { RestaurantForm } from "@/features/dashboard/RestaurantForm";
import { Card, PageHeader } from "@/features/dashboard/ui";

/** First screen after sign-up: create the restaurant. */
export default async function OnboardingPage() {
  if (await getMyRestaurant()) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Bienvenue sur Dishly" description="Quelques informations sur votre restaurant pour créer votre menu 3D. Tout est modifiable ensuite." />
      <Card>
        <RestaurantForm mode="create" />
      </Card>
    </div>
  );
}
