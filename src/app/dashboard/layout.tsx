import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/features/auth/actions";
import { getMyRestaurant } from "@/features/auth/session";
import { NavLinks, NavLinksFallback } from "@/features/dashboard/NavLinks";
import { DashboardSkeleton, buttonClass } from "@/features/dashboard/ui";

export const metadata: Metadata = { title: "Tableau de bord — Dishly", robots: { index: false } };

/**
 * Owner dashboard shell. The frame (logo, navigation) is static and shows
 * instantly; everything that depends on the signed-in owner streams in
 * inside <Suspense> boundaries (required with Cache Components).
 */
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="min-h-dvh bg-[#f6f3ee]">
      <header className="sticky top-0 z-20 border-b border-line bg-[#f6f3ee]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
          <Link href="/dashboard" className="font-display text-2xl text-ink">
            Dishly
          </Link>
          <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
            <Suspense fallback={<NavLinksFallback />}>
              <NavLinks />
            </Suspense>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <Suspense fallback={null}>
              <AccountArea />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8 pb-24">
        <Suspense fallback={<DashboardSkeleton />}>{children}</Suspense>
      </main>
    </div>
  );
}

async function AccountArea() {
  const restaurant = await getMyRestaurant();
  return (
    <>
      {restaurant ? (
        <a href={`/r/${restaurant.slug}`} target="_blank" rel="noreferrer" className={buttonClass.small}>
          Voir le menu ↗
        </a>
      ) : null}
      <form action={signOut}>
        <button type="submit" className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted hover:bg-black/[0.05] hover:text-ink">
          Déconnexion
        </button>
      </form>
    </>
  );
}
