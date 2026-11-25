"use client";

import { useState } from "react";
import { buttonClass } from "./ui";

/** Shows the public menu URL (built from the current origin) with a copy button. */
export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-xl bg-[#f6f3ee] px-3 py-2 text-sm text-ink" suppressHydrationWarning>
        {url}
      </code>
      <button
        type="button"
        className={buttonClass.small}
        onClick={async () => {
          await navigator.clipboard.writeText(`${window.location.origin}${path}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copié ✓" : "Copier"}
      </button>
    </div>
  );
}
