"use client";

import { useEffect, useState } from "react";

/**
 * Desktop visitors can't use AR: show a QR code of the current page so they
 * can continue on their phone. The QR library is loaded only here.
 */
export function OpenOnPhone({ title, text }: { title: string; text: string }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("qrcode").then(async (QRCode) => {
      const url = new URL(window.location.href);
      const markup = await QRCode.toString(url.toString(), { type: "svg", margin: 1, color: { dark: "#1f1a17", light: "#ffffff" } });
      if (!cancelled) setSvg(markup);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex items-center gap-5 rounded-3xl border border-line bg-white p-5 shadow-sm">
      <div
        className="size-28 shrink-0 rounded-xl bg-cream p-1 [&>svg]:h-full [&>svg]:w-full"
        // SVG generated locally by the qrcode library from our own URL.
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      />
      <div>
        <p className="font-display text-xl text-ink">{title}</p>
        <p className="mt-1 text-sm text-muted">{text}</p>
      </div>
    </div>
  );
}
