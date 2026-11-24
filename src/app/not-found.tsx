import Link from "next/link";
import { getDictionary, DEFAULT_LOCALE } from "@/features/i18n";

export default function NotFound() {
  const t = getDictionary(DEFAULT_LOCALE).menu;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-6xl text-line">404</p>
      <h1 className="mt-4 font-display text-3xl text-ink">{t.notFoundTitle}</h1>
      <p className="mt-3 text-muted">{t.notFoundText}</p>
      <Link href="/" className="mt-8 text-sm font-semibold text-ink underline underline-offset-4">
        Dishly
      </Link>
    </main>
  );
}
