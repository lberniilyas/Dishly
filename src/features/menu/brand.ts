import type { CSSProperties } from "react";

/** CSS variables for a restaurant's accent colour, plus a readable text colour on top of it. */
export function brandStyle(hex: string): CSSProperties {
  return { "--brand": hex, "--brand-ink": readableTextOn(hex) } as CSSProperties;
}

/** White or near-black, whichever contrasts best with the background (WCAG relative luminance). */
export function readableTextOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  return luminance > 0.4 ? "#1f1a17" : "#ffffff";
}
