import Link from "next/link";
import { DEMO_SLUG } from "@/features/menu/queries";

/** Minimal home page. Diners never see it: QR codes point straight to /r/[slug]. */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold tracking-widest text-[#b4532a] uppercase">Dishly</p>
      <h1 className="mt-3 font-display text-5xl leading-[1.05] text-ink">Vos plats en 3D, sur la table du client.</h1>
      <p className="mt-5 text-lg text-muted">
        Un QR code sur la table, le menu s&apos;ouvre dans le navigateur, et chaque plat apparaît en réalité augmentée, à sa taille réelle, avant
        même d&apos;être commandé.
      </p>
      <Link
        href={`/r/${DEMO_SLUG}`}
        className="mt-8 inline-flex h-12 w-fit items-center rounded-full bg-ink px-6 font-semibold text-white transition active:scale-[0.98]"
      >
        Voir le menu de démonstration →
      </Link>
    </main>
  );
}
