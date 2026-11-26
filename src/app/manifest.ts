import type { MetadataRoute } from "next";

/** PWA instalable: necesaria para Web Push en iPhone y para abrir MyFarma como app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyFarma — Encuentra tu medicamento",
    short_name: "MyFarma",
    description: "Encuentra en qué farmacia de Panamá hay tu medicamento, reportado por pacientes.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f0f3f6",
    theme_color: "#f0f3f6",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
