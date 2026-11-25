"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "./ui";

/** Submit button that disables itself and shows a spinner while its form is being sent. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: keyof typeof buttonClass;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={`${buttonClass[variant]} ${className}`}>
      {pending ? <Spinner /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
