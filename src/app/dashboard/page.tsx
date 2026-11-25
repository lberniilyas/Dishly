import Link from "next/link";
import { requireRestaurant } from "@/features/auth/session";
import { setPublished } from "@/features/dashboard/actions/restaurant";
import { CopyLink } from "@/features/dashboard/CopyLink";
import { getMenuForEditing, getOverviewStats } from "@/features/dashboard/data";
import { SubmitButton } from "@/features/dashboard/SubmitButton";
import { Badge, Card, PageHeader, buttonClass } from "@/features/dashboard/ui";

export default async function DashboardHome() {
  const restaurant = await requireRestaurant();
  const [stats, menu] = await Promise.all([getOverviewStats(restaurant.id), getMenuForEditing(restaurant.id)]);
  const dishes = menu.dishes;
  const withPhoto = dishes.filter((d) => d.photo).length;
  const with3d = dishes.filter((d) => d.active_model_id).length;

  return (
    <>
      <PageHeader title={restaurant.name} description="Votre menu 3D en un coup d'œil." />

      <div className="grid gap-5">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-ink">Menu public</h2>
                {restaurant.is_published ? <Badge tone="good">En ligne</Badge> : <Badge tone="warn">Hors ligne</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted">
                {restaurant.is_published
                  ? "Les clients qui scannent votre QR code voient ce menu."
                  : "Votre menu n'est pas encore visible. Publiez-le quand il est prêt."}
              </p>
            </div>
            <form action={setPublished.bind(null, !restaurant.is_published)}>
              <SubmitButton variant={restaurant.is_published ? "secondary" : "primary"}>
                {restaurant.is_published ? "Mettre hors ligne" : "Publier le menu"}
              </SubmitButton>
            </form>
          </div>
          <div className="mt-5">
            <CopyLink path={`/r/${restaurant.slug}`} />
          </div>
        </Card>

        <Card title="7 derniers jours" description="Ce que vos clients ont regardé.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Scans du menu" value={stats.menuViews} />
            <Stat label="Plats consultés" value={stats.dishViews} />
            <Stat label="Vues en 3D" value={stats.modelLoads} />
            <Stat label="Posés sur la table (AR)" value={stats.arLaunches} highlight />
          </div>
        </Card>

        <Card title="Votre menu">
          {dishes.length === 0 ? (
            <div className="rounded-2xl bg-[#f6f3ee] p-5">
              <p className="font-semibold text-ink">Votre menu est vide.</p>
              <p className="mt-1 text-sm text-muted">Photographiez votre carte papier : l&apos;IA crée les catégories, les plats et les prix en une minute.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/dashboard/import" className={buttonClass.primary}>
                  Importer mon menu avec l&apos;IA
                </Link>
                <Link href="/dashboard/menu" className={buttonClass.secondary}>
                  Créer à la main
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Plats" value={dishes.length} />
              <Stat label="Avec photo" value={withPhoto} of={dishes.length} />
              <Stat label="En 3D / AR" value={with3d} of={dishes.length} highlight />
            </div>
          )}
          {dishes.length > 0 && with3d === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Astuce : ajoutez un modèle 3D à vos plats phares depuis la page de chaque plat (bouton « Modèle 3D »).
            </p>
          ) : null}
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, of, highlight }: { label: string; value: number; of?: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${highlight ? "bg-[#b4532a]/10" : "bg-[#f6f3ee]"}`}>
      <p className={`text-3xl font-semibold tabular-nums ${highlight ? "text-[#b4532a]" : "text-ink"}`}>
        {value}
        {of != null ? <span className="text-base font-medium text-muted"> / {of}</span> : null}
      </p>
      <p className="mt-1 text-xs font-medium text-muted">{label}</p>
    </div>
  );
}
