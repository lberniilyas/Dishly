"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Aperçu", exact: true },
  { href: "/dashboard/menu", label: "Menu" },
  { href: "/dashboard/import", label: "Import IA" },
  { href: "/dashboard/restaurant", label: "Restaurant" },
];

/** Highlights the current section. Reads the URL, so it renders inside <Suspense>. */
export function NavLinks() {
  return <NavList pathname={usePathname()} />;
}

/** Same links without highlight: shown in the static shell until the URL is known. */
export function NavLinksFallback() {
  return <NavList pathname="" />;
}

function NavList({ pathname }: { pathname: string }) {
  return (
    <nav className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto" aria-label="Tableau de bord">
      {LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href) || (link.href === "/dashboard/menu" && pathname.startsWith("/dashboard/dishes"));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${active ? "bg-ink text-white" : "text-muted hover:bg-black/[0.05] hover:text-ink"}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
