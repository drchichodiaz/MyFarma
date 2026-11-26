import type { MetadataRoute } from "next";
import { connection } from "next/server";

/**
 * robots.txt. Mientras haya datos de ejemplo, no se indexa nada.
 * En el lanzamiento: INDEXING=1 en el .env del servidor (y ROBOTS_TAG=all para Caddy).
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection(); // se decide con el .env del servidor, no en el build
  const base = process.env.PUBLIC_URL ?? "https://myfarma.net";
  if (process.env.INDEXING !== "1") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/cuenta", "/entrar", "/api/", "/alertas/desactivar", "/no-encontrado"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
