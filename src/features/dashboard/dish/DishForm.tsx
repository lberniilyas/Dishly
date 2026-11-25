"use client";

import { useActionState } from "react";
import { getDictionary } from "@/features/i18n";
import { saveDish } from "../actions/dish";
import { DISH_TAGS, type FormState } from "../form-utils";
import { SubmitButton } from "../SubmitButton";
import { Field, Notice, inputClass } from "../ui";

interface Props {
  dishId: string;
  initial: { name: string; description: string; price: string; categoryId: string | null; tags: string[]; isAvailable: boolean };
  categories: { id: string; name: string }[];
  currency: string;
}

const tagLabels = getDictionary("fr").tags;

export function DishForm({ dishId, initial, categories, currency }: Props) {
  const [state, action] = useActionState<FormState, FormData>(saveDish.bind(null, dishId), {});
  return (
    <form action={action} className="space-y-5">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.success ? <Notice tone="success">{state.success}</Notice> : null}

      <Field label="Nom du plat" htmlFor="name">
        <input id="name" name="name" required maxLength={120} defaultValue={initial.name} className={inputClass} />
      </Field>
      <Field label="Description" htmlFor="description" hint="Ingrédients, cuisson, accompagnement… 2 à 3 lignes suffisent.">
        <textarea id="description" name="description" rows={3} maxLength={600} defaultValue={initial.description} className={inputClass} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={`Prix (${currency})`} htmlFor="price" hint="Laissez vide pour ne pas afficher de prix.">
          <input id="price" name="price" inputMode="decimal" defaultValue={initial.price} placeholder="13,50" className={inputClass} />
        </Field>
        <Field label="Catégorie" htmlFor="category_id">
          <select id="category_id" name="category_id" defaultValue={initial.categoryId ?? ""} className={inputClass}>
            <option value="">— Sans catégorie —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Étiquettes">
        <div className="flex flex-wrap gap-2">
          {DISH_TAGS.map((tag) => (
            <label key={tag} className="cursor-pointer">
              <input type="checkbox" name="tags" value={tag} defaultChecked={initial.tags.includes(tag)} className="peer sr-only" />
              <span className="inline-block rounded-full px-3 py-1.5 text-sm font-medium text-muted ring-1 ring-line transition peer-checked:bg-ink peer-checked:text-white peer-checked:ring-ink peer-focus-visible:ring-2">
                {tagLabels[tag] ?? tag}
              </span>
            </label>
          ))}
        </div>
      </Field>
      <label className="flex items-center gap-3 rounded-2xl bg-[#f6f3ee] px-4 py-3">
        <input type="checkbox" name="is_available" defaultChecked={initial.isAvailable} className="size-5 accent-[#1f1a17]" />
        <span className="text-sm">
          <span className="font-semibold text-ink">Afficher sur le menu</span>
          <span className="block text-muted">Décochez pour masquer le plat (rupture, plat de saison…).</span>
        </span>
      </label>
      <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
    </form>
  );
}
