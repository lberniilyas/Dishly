"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export interface AuthState {
  error?: string;
  message?: string;
}

/** Only allow redirects to our own pages (prevents open-redirect tricks). */
function safeNext(value: FormDataEntryValue | null, fallback: string): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  return h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: field(formData, "email"),
    password: String(formData.get("password") ?? ""),
  });
  if (error) {
    return {
      error: error.code === "email_not_confirmed" ? "Confirmez d'abord votre adresse e-mail (lien reçu par e-mail)." : "E-mail ou mot de passe incorrect.",
    };
  }
  redirect(safeNext(formData.get("next"), "/dashboard"));
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = field(formData, "email");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/dashboard/onboarding` },
  });
  if (error) {
    return { error: error.code === "user_already_exists" ? "Un compte existe déjà avec cet e-mail." : "Inscription impossible. Vérifiez l'adresse e-mail." };
  }
  // Email confirmation disabled → signed in immediately.
  if (data.session) redirect("/dashboard/onboarding");
  return { message: `Presque fini ! Ouvrez le lien envoyé à ${email} pour activer votre compte.` };
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createServerSupabase();
  await supabase.auth.resetPasswordForEmail(field(formData, "email"), {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });
  // Same answer whether or not the account exists (doesn't leak who is a customer).
  return { message: "Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé." };
}

export async function updatePassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Le lien a expiré. Recommencez la procédure « mot de passe oublié »." };
  redirect("/dashboard");
}
