"use client";

import { useActionState, useState } from "react";
import { createRestaurant, updateRestaurant } from "./actions/restaurant";
import { CURRENCIES, slugify, type FormState } from "./form-utils";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice, inputClass } from "./ui";

interface Initial {
  name: string;
  slug: string;
  tagline: string;
  brand_color: string;
  currency: string;
}

const SWATCHES = ["#B4532A", "#7C2D12", "#1F4E3D", "#2F4858", "#8B1E3F", "#C2410C", "#1F1A17", "#6D28D9"];

/** Create (onboarding) or edit the restaurant. */
export function RestaurantForm({ mode, initial }: { mode: "create" | "edit"; initial?: Initial }) {
  const [state, action] = useActionState<FormState, FormData>(mode === "create" ? createRestaurant : updateRestaurant, {});
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [color, setColor] = useState(initial?.brand_color ?? "#B4532A");
  const shownSlug = slugTouched ? slug : slugify(name);

  return (
    <form action={action} className="space-y-5">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.success ? <Notice tone="success">{state.success}</Notice> : null}

      <Field label="Nom du restaurant" htmlFor="name">
        <input id="name" name="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Le Petit Bistrot" />
      </Field>

      <Field
        label="Adresse du menu"
        htmlFor="slug"
        hint={mode === "edit" ? "Attention : changer l'adresse rend vos QR codes déjà imprimés invalides." : "C'est l'adresse encodée dans vos QR codes."}
      >
        <div className="flex items-center overflow-hidden rounded-xl border border-line bg-white shadow-sm focus-within:border-ink/30 focus-within:ring-2 focus-within:ring-ink/10">
          <span className="shrink-0 ps-3.5 text-[15px] text-muted">…/r/</span>
          <input
            id="slug"
            name="slug"
            required
            value={shownSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            className="w-full bg-transparent px-1 py-2.5 text-[15px] text-ink outline-none"
            pattern="[a-z0-9]([a-z0-9\-]{0,48}[a-z0-9])?"
          />
        </div>
      </Field>

      <Field label="Accroche (facultatif)" htmlFor="tagline" hint="Affichée sous le nom, en haut du menu.">
        <input id="tagline" name="tagline" maxLength={140} defaultValue={initial?.tagline ?? ""} className={inputClass} placeholder="Cuisine maison, produits frais" />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Couleur de la marque" hint="Boutons et badges du menu.">
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Couleur ${swatch}`}
                onClick={() => setColor(swatch)}
                className={`size-8 rounded-full ring-offset-2 transition ${color.toLowerCase() === swatch.toLowerCase() ? "ring-2 ring-ink" : ""}`}
                style={{ backgroundColor: swatch }}
              />
            ))}
            <input type="color" aria-label="Couleur personnalisée" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded-lg border border-line bg-white" />
            <input type="hidden" name="brand_color" value={color} />
          </div>
        </Field>
        <Field label="Devise" htmlFor="currency">
          <select id="currency" name="currency" defaultValue={initial?.currency ?? "EUR"} className={inputClass}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <SubmitButton pendingLabel="Enregistrement…">{mode === "create" ? "Créer mon restaurant" : "Enregistrer"}</SubmitButton>
    </form>
  );
}
