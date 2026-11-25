import Link from "next/link";

/** Centered card layout shared by the account screens. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#f6f3ee] px-5 py-12">
      <Link href="/" className="mb-8 font-display text-3xl text-ink">
        Dishly
      </Link>
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-sm ring-1 ring-line">{children}</div>
      <p className="mt-6 max-w-xs text-center text-xs text-muted">Espace restaurateur — gérez votre menu 3D, vos plats et vos QR codes.</p>
    </main>
  );
}
