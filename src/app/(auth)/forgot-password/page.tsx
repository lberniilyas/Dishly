import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/features/auth/AuthForm";

export const metadata: Metadata = { title: "Mot de passe oublié — Dishly" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold text-ink">Mot de passe oublié</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Recevez un lien pour en choisir un nouveau.</p>
      <Suspense>
        <AuthForm mode="forgot" />
      </Suspense>
    </>
  );
}
