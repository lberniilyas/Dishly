"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Sticky, horizontally scrollable category bar. Highlights the category
 * currently on screen and scrolls to a section when tapped.
 */
export function CategoryNav({ categories }: { categories: { id: string; label: string }[] }) {
  const [active, setActive] = useState(categories[0]?.id);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.replace(/^cat-/, ""));
      },
      // A section counts as "current" when it crosses the upper part of the screen.
      { rootMargin: "-80px 0px -60% 0px" },
    );
    for (const c of categories) {
      const el = document.getElementById(`cat-${c.id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [categories]);

  // Keep the active chip visible inside the horizontal bar.
  useEffect(() => {
    barRef.current?.querySelector<HTMLElement>(`[data-id="${active}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);

  if (categories.length < 2) return null;

  return (
    <nav className="sticky top-0 z-10 border-b border-line bg-cream/90 backdrop-blur" aria-label="Catégories">
      <div ref={barRef} className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
        {categories.map((c) => (
          <a
            key={c.id}
            href={`#cat-${c.id}`}
            data-id={c.id}
            onClick={() => setActive(c.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              active === c.id ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-line"
            }`}
          >
            {c.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
