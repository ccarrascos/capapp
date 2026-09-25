import type { Metadata } from "next";
import { Big_Shoulders, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// next/font no tiene métricas de Big Shoulders para calcular un fallback
// ajustado; se declara uno condensado a mano.
const display = Big_Shoulders({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  adjustFontFallback: false,
  fallback: ["Arial Narrow", "Roboto Condensed", "sans-serif"],
});

const body = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Capapp - Capacitación DS 44",
  description:
    "Gestión de capacitación en prevención de riesgos laborales (art. 16, DS N.º 44/2023).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
