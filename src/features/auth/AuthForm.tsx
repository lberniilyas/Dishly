"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { SubmitButton } from "@/features/dashboard/SubmitButton";
import { Field, Notice, inputClass } from "@/features/dashboard/ui";
import { requestPasswordReset, signIn, signUp, updatePassword, type AuthState } from "./actions";

type Mode = "login" | "signup" | "forgot" | "reset";

const ACTIONS = { login: signIn, signup: signUp, forgot: requestPasswordReset, reset: updatePassword };
const SUBMIT = { login: "Se connecter", signup: "Créer mon compte", forgot: "Envoyer le lien", reset: "Enregistrer le mot de passe" };

/** One form component for the four account screens. */
export function AuthForm({ mode }: { mode: Mode }) {
  const [state, action] = useActionState<AuthState, FormData>(ACTIONS[mode], {});
  const params = useSearchParams();
  const linkError = params.get("error") === "link";

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      {linkError ? <Notice tone="error">Ce lien n&apos;est plus valide. Recommencez, s&apos;il vous plaît.</Notice> : null}
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.message ? <Notice tone="success">{state.message}</Notice> : null}

      {mode !== "reset" ? (
        <Field label="E-mail" htmlFor="email">
          <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} placeholder="vous@restaurant.fr" />
        </Field>
      ) : null}
      {mode !== "forgot" ? (
        <Field
          label={mode === "reset" ? "Nouveau mot de passe" : "Mot de passe"}
          htmlFor="password"
          hint={mode === "signup" || mode === "reset" ? "8 caractères minimum." : undefined}
        >
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === "login" ? undefined : 8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className={inputClass}
          />
        </Field>
      ) : null}

      <SubmitButton className="w-full" pendingLabel="Un instant…">
        {SUBMIT[mode]}
      </SubmitButton>

      <div className="flex flex-wrap justify-between gap-2 text-sm">
        {mode === "login" ? (
          <>
            <Link href="/signup" className="font-semibold text-ink underline-offset-4 hover:underline">
              Créer un compte
            </Link>
            <Link href="/forgot-password" className="text-muted underline-offset-4 hover:underline">
              Mot de passe oublié ?
            </Link>
          </>
        ) : (
          <Link href="/login" className="font-semibold text-ink underline-offset-4 hover:underline">
            ← J&apos;ai déjà un compte
          </Link>
        )}
      </div>
    </form>
  );
}
