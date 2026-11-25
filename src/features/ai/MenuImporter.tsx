"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { downscaleImage, formatBytes } from "@/features/media/client-image";
import { parsePriceToCents, centsToInput, DISH_TAGS } from "@/features/dashboard/form-utils";
import { Spinner } from "@/features/dashboard/SubmitButton";
import { Notice, buttonClass, inputClass } from "@/features/dashboard/ui";
import { getDictionary } from "@/features/i18n";
import { extractMenuAction, importMenuDraft, type ImportPayload } from "./actions";
import type { MenuDraft } from "./menu-extraction";

type Tag = (typeof DISH_TAGS)[number];
interface DraftDish {
  key: string;
  include: boolean;
  name: string;
  description: string;
  price: string;
  tags: Tag[];
}
interface DraftCategory {
  key: string;
  name: string;
  dishes: DraftDish[];
}
type Phase = "pick" | "reading" | "review" | "importing" | "done";

const tagLabels = getDictionary("fr").tags;

/**
 * AI menu import: photos/PDF of the paper menu → editable draft → import.
 * Nothing is saved until the owner clicks "Importer".
 */
export function MenuImporter({ currency, aiReady }: { currency: string; aiReady: boolean }) {
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>("pick");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftCategory[]>([]);
  const [meta, setMeta] = useState<{ warnings: string[]; currency: string | null }>({ warnings: [], currency: null });
  const [result, setResult] = useState<{ dishes: number; categories: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null)), [files]);
  useEffect(() => () => previews.forEach((p) => p && URL.revokeObjectURL(p)), [previews]);

  const selectedCount = draft.reduce((n, c) => n + c.dishes.filter((d) => d.include).length, 0);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const incoming = Array.from(list).filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
    const hasPdf = [...files, ...incoming].some((f) => f.type === "application/pdf");
    if (hasPdf && files.length + incoming.length > 1) return setError("Importez soit un PDF, soit des photos (pas les deux à la fois).");
    setFiles((prev) => [...prev, ...incoming].slice(0, 6));
  }

  async function read() {
    setError(null);
    setPhase("reading");
    const data = new FormData();
    for (const file of files) data.append("files", file.type === "application/pdf" ? file : await downscaleImage(file, 2400, 0.85));
    const response = await extractMenuAction(data);
    if ("error" in response) {
      setError(response.error);
      setPhase("pick");
      return;
    }
    setDraft(toEditable(response.draft));
    setMeta({ warnings: response.draft.warnings, currency: response.draft.currency });
    setPhase("review");
  }

  async function save() {
    setError(null);
    const payload: ImportPayload = { categories: [] };
    for (const category of draft) {
      const dishes = [];
      for (const dish of category.dishes.filter((d) => d.include)) {
        const price = parsePriceToCents(dish.price);
        if (price === undefined) return setError(`Prix invalide pour « ${dish.name} ».`);
        if (!dish.name.trim()) return setError("Un plat sélectionné n'a pas de nom.");
        dishes.push({ name: dish.name.trim(), description: dish.description.trim() || null, price_cents: price, tags: dish.tags });
      }
      if (dishes.length) payload.categories.push({ name: category.name.trim() || "Sans titre", dishes });
    }
    setPhase("importing");
    const response = await importMenuDraft(payload);
    if (response.error) {
      setError(response.error);
      setPhase("review");
      return;
    }
    setResult({ dishes: response.dishes ?? 0, categories: response.categories ?? 0 });
    setPhase("done");
  }

  function updateDish(categoryKey: string, dishKey: string, patch: Partial<DraftDish>) {
    setDraft((prev) => prev.map((c) => (c.key !== categoryKey ? c : { ...c, dishes: c.dishes.map((d) => (d.key === dishKey ? { ...d, ...patch } : d)) })));
  }

  if (phase === "done" && result) {
    return (
      <div className="space-y-4">
        <Notice tone="success">
          {result.dishes} plat(s) importé(s){result.categories ? `, ${result.categories} nouvelle(s) catégorie(s)` : ""}. Ils sont déjà visibles sur votre menu.
        </Notice>
        <p className="text-sm text-muted">Prochaine étape : ajoutez des photos et la 3D à vos plats phares.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/menu" className={buttonClass.primary}>
            Voir mon menu
          </Link>
          <button
            type="button"
            className={buttonClass.secondary}
            onClick={() => {
              setFiles([]);
              setDraft([]);
              setResult(null);
              setPhase("pick");
            }}
          >
            Importer d&apos;autres pages
          </button>
        </div>
      </div>
    );
  }

  if (phase === "review" || phase === "importing") {
    return (
      <div className="space-y-5">
        <Notice tone="info">
          Vérifiez et corrigez si besoin, puis importez. Décochez ce que vous ne voulez pas garder.
          {meta.currency && meta.currency !== currency ? ` Prix lus en ${meta.currency} (votre restaurant est en ${currency}).` : ""}
        </Notice>
        {meta.warnings.length ? (
          <Notice tone="warn">
            <p className="font-semibold">À vérifier :</p>
            <ul className="mt-1 list-disc space-y-1 ps-4">
              {meta.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Notice>
        ) : null}

        {draft.map((category) => (
          <div key={category.key} className="rounded-2xl ring-1 ring-line">
            <div className="border-b border-line bg-[#f6f3ee] px-4 py-3">
              <input
                value={category.name}
                onChange={(e) => setDraft((prev) => prev.map((c) => (c.key === category.key ? { ...c, name: e.target.value } : c)))}
                className="w-full bg-transparent font-display text-xl text-ink outline-none"
                aria-label="Nom de la catégorie"
              />
            </div>
            <ul className="divide-y divide-line">
              {category.dishes.map((dish) => (
                <li key={dish.key} className={`grid gap-2 px-4 py-3 sm:grid-cols-[auto_1fr_7rem] ${dish.include ? "" : "opacity-45"}`}>
                  <input
                    type="checkbox"
                    checked={dish.include}
                    onChange={(e) => updateDish(category.key, dish.key, { include: e.target.checked })}
                    className="mt-3 size-5 accent-[#1f1a17]"
                    aria-label={`Garder ${dish.name}`}
                  />
                  <div className="space-y-1.5">
                    <input value={dish.name} onChange={(e) => updateDish(category.key, dish.key, { name: e.target.value })} className={`${inputClass} font-semibold`} aria-label="Nom du plat" />
                    <textarea
                      value={dish.description}
                      onChange={(e) => updateDish(category.key, dish.key, { description: e.target.value })}
                      rows={dish.description ? 2 : 1}
                      placeholder="Description (facultatif)"
                      className={`${inputClass} text-sm`}
                      aria-label="Description"
                    />
                    {dish.tags.length ? <p className="text-xs text-muted">{dish.tags.map((t) => tagLabels[t] ?? t).join(" · ")}</p> : null}
                  </div>
                  <input
                    value={dish.price}
                    onChange={(e) => updateDish(category.key, dish.key, { price: e.target.value })}
                    inputMode="decimal"
                    placeholder="Prix"
                    className={`${inputClass} self-start text-end tabular-nums`}
                    aria-label="Prix"
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}

        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-line backdrop-blur">
          <button type="button" className={buttonClass.primary} disabled={phase === "importing" || selectedCount === 0} onClick={save}>
            {phase === "importing" ? <Spinner /> : null}
            Importer {selectedCount} plat{selectedCount > 1 ? "s" : ""}
          </button>
          <button type="button" className={buttonClass.secondary} disabled={phase === "importing"} onClick={() => setPhase("pick")}>
            Recommencer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!aiReady ? <Notice tone="warn">Le service IA n&apos;est pas configuré sur ce serveur (AI_GATEWAY_API_KEY). Voir le README.</Notice> : null}

      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
        disabled={phase === "reading"}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line bg-[#f6f3ee] px-6 py-10 text-center transition hover:border-ink/30"
      >
        <span className="text-3xl" aria-hidden>
          📷
        </span>
        <span className="font-semibold text-ink">Photos de votre carte ou PDF</span>
        <span className="text-sm text-muted">Une photo par page, bien droite et lisible. Jusqu&apos;à 6 photos.</span>
      </button>
      <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => addFiles(e.target.files)} />

      {files.length ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="relative">
              <div className="aspect-[3/4] overflow-hidden rounded-xl bg-white ring-1 ring-line">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                {previews[i] ? <img src={previews[i]!} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-xs font-semibold text-muted">PDF</div>}
              </div>
              <p className="mt-1 truncate text-[11px] text-muted">{formatBytes(file.size)}</p>
              <button
                type="button"
                aria-label="Retirer"
                className="absolute -end-2 -top-2 grid size-6 place-items-center rounded-full bg-ink text-xs text-white"
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                disabled={phase === "reading"}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}

      <button type="button" className={buttonClass.primary} disabled={!files.length || phase === "reading"} onClick={read}>
        {phase === "reading" ? (
          <>
            <Spinner /> Lecture du menu… (20 à 60 secondes)
          </>
        ) : (
          "Lire le menu avec l'IA"
        )}
      </button>
    </div>
  );
}

function toEditable(draft: MenuDraft): DraftCategory[] {
  let n = 0;
  return draft.categories
    .filter((c) => c.dishes.length > 0)
    .map((c) => ({
      key: `c${n++}`,
      name: c.name,
      dishes: c.dishes.map((d) => ({
        key: `d${n++}`,
        include: true,
        name: d.name,
        description: d.description ?? "",
        price: d.price == null ? "" : centsToInput(Math.round(d.price * 100)),
        tags: d.tags,
      })),
    }));
}
