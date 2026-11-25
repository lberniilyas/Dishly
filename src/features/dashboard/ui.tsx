import type { ReactNode } from "react";

/**
 * Small set of dashboard UI building blocks (plain Tailwind, no UI library).
 * Class strings are exported so forms and client components share one look.
 */

export const inputClass =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink shadow-sm outline-none transition placeholder:text-muted/60 focus:border-ink/30 focus:ring-2 focus:ring-ink/10 disabled:opacity-60";

export const buttonClass = {
  primary:
    "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  secondary:
    "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-ink ring-1 ring-line transition hover:bg-black/[0.03] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  small:
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-semibold text-ink ring-1 ring-line transition hover:bg-black/[0.03] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
  danger:
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-red-700 ring-1 ring-red-200 transition hover:bg-red-50 disabled:opacity-50",
  icon: "grid size-8 place-items-center rounded-full text-muted ring-1 ring-line transition hover:bg-black/[0.04] hover:text-ink disabled:pointer-events-none disabled:opacity-30",
};

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[34px] leading-tight text-ink">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ title, description, children, className = "" }: { title?: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl bg-white p-6 shadow-sm ring-1 ring-line ${className}`}>
      {title ? <h2 className="text-lg font-semibold text-ink">{title}</h2> : null}
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      {title || description ? <div className="mt-5">{children}</div> : children}
    </section>
  );
}

export function Field({ label, hint, htmlFor, children }: { label: string; hint?: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "brand" | "bad" }) {
  const tones = {
    neutral: "bg-black/[0.05] text-muted",
    good: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
    warn: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
    bad: "bg-red-50 text-red-700 ring-1 ring-red-200",
    brand: "bg-[#b4532a] text-white",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warn"; children: ReactNode }) {
  const tones = {
    info: "bg-sky-50 text-sky-900 ring-sky-200",
    error: "bg-red-50 text-red-800 ring-red-200",
    success: "bg-emerald-50 text-emerald-900 ring-emerald-200",
    warn: "bg-amber-50 text-amber-900 ring-amber-200",
  };
  return <div className={`rounded-2xl px-4 py-3 text-sm ring-1 ${tones[tone]}`}>{children}</div>;
}

export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Chargement">
      <div className="h-10 w-64 rounded-xl bg-line" />
      <div className="h-40 rounded-3xl bg-white ring-1 ring-line" />
      <div className="h-64 rounded-3xl bg-white ring-1 ring-line" />
    </div>
  );
}
