"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createCategory, deleteCategory, renameCategory } from "./actions/menu";
import type { FormState } from "./form-utils";
import { SubmitButton, Spinner } from "./SubmitButton";
import { Notice, buttonClass, inputClass } from "./ui";

/** "Add a category" inline form; clears itself after success. */
export function AddCategoryForm() {
  const [state, action] = useActionState<FormState, FormData>(createCategory, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="flex flex-wrap items-start gap-2">
      <input name="name" required maxLength={60} placeholder="Nouvelle catégorie (ex. Entrées)" className={`${inputClass} max-w-xs`} />
      <SubmitButton variant="secondary" pendingLabel="Ajout…">
        Ajouter
      </SubmitButton>
      {state.error ? <div className="w-full">{<Notice tone="error">{state.error}</Notice>}</div> : null}
    </form>
  );
}

/** Category title that turns into an input when "Renommer" is clicked. */
export function CategoryTitle({ id, name, children }: { id: string; name: string; children?: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(async (previous, formData) => {
    const result = await renameCategory(id, previous, formData);
    if (result.success) setEditing(false);
    return result;
  }, {});

  if (editing) {
    return (
      <form action={action} className="flex flex-1 flex-wrap items-center gap-2">
        <input name="name" defaultValue={name} required maxLength={60} autoFocus className={`${inputClass} max-w-xs`} />
        <SubmitButton variant="small">OK</SubmitButton>
        <button type="button" className="text-sm text-muted hover:text-ink" onClick={() => setEditing(false)}>
          Annuler
        </button>
        {state.error ? <span className="text-sm text-red-700">{state.error}</span> : null}
      </form>
    );
  }
  return (
    <div className="flex flex-1 flex-wrap items-center gap-2">
      <h2 className="font-display text-2xl text-ink">{name}</h2>
      {children}
      <button type="button" className="text-[13px] font-semibold text-muted underline-offset-4 hover:text-ink hover:underline" onClick={() => setEditing(true)}>
        Renommer
      </button>
    </div>
  );
}

export function DeleteCategoryButton({ id, name, dishCount }: { id: string; name: string; dishCount: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClass.danger}
      onClick={() => {
        const message =
          dishCount > 0
            ? `Supprimer la catégorie « ${name} » ? Ses ${dishCount} plat(s) seront conservés dans « Sans catégorie ».`
            : `Supprimer la catégorie « ${name} » ?`;
        if (confirm(message)) start(() => deleteCategory(id));
      }}
    >
      {pending ? <Spinner /> : null}
      Supprimer
    </button>
  );
}

/** Small icon button bound to a Server Action (reorder, toggle…), with pending state. */
export function ActionIconButton({ action, label, children, disabled }: { action: () => Promise<void>; label: string; children: ReactNode; disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled || pending} className={buttonClass.icon} onClick={() => start(action)}>
      {pending ? <Spinner className="size-3.5" /> : children}
    </button>
  );
}

export function ActionButton({ action, children, variant = "small" }: { action: () => Promise<void>; children: ReactNode; variant?: keyof typeof buttonClass }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className={buttonClass[variant]} onClick={() => start(action)}>
      {pending ? <Spinner /> : null}
      {children}
    </button>
  );
}
