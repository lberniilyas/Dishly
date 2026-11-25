import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/features/auth/AuthForm";

export const metadata: Metadata = { title: "Connexion — Dishly" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold text-ink">Connexion</h1>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </>
  );
}
