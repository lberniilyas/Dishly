import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/features/auth/AuthForm";

export const metadata: Metadata = { title: "Nouveau mot de passe — Dishly" };

/** Reached from the reset e-mail (the callback has already signed the owner in). */
export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold text-ink">Choisissez un nouveau mot de passe</h1>
      <Suspense>
        <AuthForm mode="reset" />
      </Suspense>
    </>
  );
}
