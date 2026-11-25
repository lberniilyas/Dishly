"use client";

import { startTransition, useActionState, useRef, useState, useTransition } from "react";
import { downscaleImage } from "@/features/media/client-image";
import { removeDishPhoto, uploadDishPhoto } from "../actions/dish";
import type { FormState } from "../form-utils";
import { Spinner } from "../SubmitButton";
import { Notice, buttonClass } from "../ui";

/** Dish photo: picked on the phone or computer, shrunk in the browser, then sent. */
export function PhotoUploader({ dishId, photoUrl }: { dishId: string; photoUrl: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadDishPhoto.bind(null, dishId), {});
  const [preparing, setPreparing] = useState(false);
  const [removing, startRemoving] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const busy = pending || preparing;

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full max-w-64 overflow-hidden rounded-2xl bg-[#f6f3ee] ring-1 ring-line">
        {/* eslint-disable-next-line @next/next/no-img-element -- pre-resized photo */}
        {photoUrl ? <img src={photoUrl} alt="Photo du plat" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-sm text-muted">Pas de photo</div>}
        {busy ? (
          <div className="absolute inset-0 grid place-items-center bg-white/70">
            <Spinner className="size-6" />
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass.small} disabled={busy} onClick={() => input.current?.click()}>
          {photoUrl ? "Changer la photo" : "Ajouter une photo"}
        </button>
        {photoUrl ? (
          <button type="button" className={buttonClass.danger} disabled={removing || busy} onClick={() => startRemoving(() => removeDishPhoto(dishId))}>
            Retirer
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted">Photo carrée de préférence, plat bien éclairé. Elle sert aussi d&apos;aperçu pendant le chargement de la 3D.</p>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setPreparing(true);
          const small = await downscaleImage(file, 2048);
          setPreparing(false);
          const data = new FormData();
          data.set("photo", small);
          startTransition(() => action(data));
        }}
      />
    </div>
  );
}
