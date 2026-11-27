import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@/components/site/analytics";
import { BottomNav } from "@/components/site/nav-links";
import { RegisterServiceWorker } from "@/components/site/register-sw";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import "./globals.css";

// Fuentes alojadas en nuestro propio servidor (next/font): variables, solo el subconjunto latino.
const display = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap" });
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  preload: false, // solo se usa en precios y dosis; no bloquea el primer render
});

export const metadata: Metadata = {
  // Base de las URLs absolutas (vistas previas al compartir). El dominio de producción.
  metadataBase: new URL("https://myfarma.net"),
  title: { default: "MyFarma — Encuentra tu medicamento", template: "%s · MyFarma" },
  description:
    "Encuentra en qué farmacia de Panamá hay tu medicamento, a qué precio y cuándo se confirmó. Reportes de pacientes.",
  applicationName: "MyFarma",
  appleWebApp: { capable: true, title: "MyFarma", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0f3f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1e" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-bg font-sans text-ink antialiased">
        <SiteHeader />
        {/* Al menos una pantalla: mientras las páginas llegan en streaming, el pie queda fuera
            de la vista y no "salta" cuando aparece el contenido (CLS). */}
        <main className="min-h-dvh">{children}</main>
        <SiteFooter />
        <BottomNav />
        <RegisterServiceWorker />
        <Analytics />
      </body>
    </html>
  );
}
