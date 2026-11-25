import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/features/auth/AuthForm";

export const metadata: Metadata = { title: "Créer un compte — Dishly" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-xl font-semibold text-ink">Créer votre espace restaurant</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Gratuit pendant la phase pilote.</p>
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </>
  );
}
