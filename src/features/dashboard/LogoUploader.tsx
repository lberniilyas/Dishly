"use client";

import { startTransition, useActionState, useRef, useState, useTransition } from "react";
import { downscaleImage } from "@/features/media/client-image";
import { removeLogo, uploadLogo } from "./actions/restaurant";
import type { FormState } from "./form-utils";
import { Spinner } from "./SubmitButton";
import { Notice, buttonClass } from "./ui";

export function LogoUploader({ logoUrl }: { logoUrl: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadLogo, {});
  const [preparing, setPreparing] = useState(false);
  const [removing, startRemoving] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const busy = pending || preparing;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="grid size-20 place-items-center overflow-hidden rounded-2xl bg-[#f6f3ee] ring-1 ring-line">
          {/* eslint-disable-next-line @next/next/no-img-element -- pre-resized logo */}
          {logoUrl ? <img src={logoUrl} alt="Logo" className="size-full object-contain p-2" /> : <span className="text-xs text-muted">Aucun logo</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass.small} disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Spinner /> : null}
            {logoUrl ? "Changer" : "Ajouter un logo"}
          </button>
          {logoUrl ? (
            <button type="button" className={buttonClass.danger} disabled={removing} onClick={() => startRemoving(() => removeLogo())}>
              Retirer
            </button>
          ) : null}
        </div>
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
            const small = await downscaleImage(file, 1024);
            setPreparing(false);
            const data = new FormData();
            data.set("logo", small);
            startTransition(() => action(data));
          }}
        />
      </div>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
    </div>
  );
}
