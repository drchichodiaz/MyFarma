import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getAllMedications, getConditions } from "@/server/services/catalog";

/** Páginas públicas: portada, buscar, cada medicamento y cada condición. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // lee la base: nunca en el build
  const base = process.env.PUBLIC_URL ?? "https://myfarma.net";
  const [meds, conditions] = await Promise.all([getAllMedications(), getConditions()]);
  return [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/buscar`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/alertas`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terminos`, changeFrequency: "yearly", priority: 0.2 },
    ...meds.map((m) => ({
      url: `${base}/m/${m.slug}`,
      changeFrequency: "hourly" as const,
      priority: 0.9,
    })),
    ...conditions.map((c) => ({
      url: `${base}/c/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
