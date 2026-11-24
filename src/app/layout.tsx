import type { Metadata, Viewport } from "next";
import { DM_Serif_Display } from "next/font/google";
import { DEFAULT_LOCALE, textDirection } from "@/features/i18n";
import "./globals.css";

// One small display font for titles (self-hosted by Next, no layout shift).
// Body text uses the phone's system font: zero download.
const display = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Dishly — menus en 3D", template: "%s" },
  description: "Découvrez les plats en 3D et posez-les sur votre table en réalité augmentée avant de commander.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets the AR button sit above the iPhone home indicator
  themeColor: "#fbf7f1",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Phase 3 will set lang/dir per restaurant language (Arabic → rtl).
  return (
    <html lang={DEFAULT_LOCALE} dir={textDirection(DEFAULT_LOCALE)} className={`${display.variable} antialiased`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
