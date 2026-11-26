import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Modelo de caché de Next 16: todo es dinámico salvo lo marcado con "use cache".
  cacheComponents: true,
  partialPrefetching: true,
  // Memoización automática: evita re-renders sin useMemo/useCallback manuales.
  reactCompiler: true,
  // Imagen de Docker mínima: .next/standalone con server.js y solo los node_modules necesarios.
  output: "standalone",
  poweredByHeader: false,
  // Cloudflare y Caddy comprimen; Node no gasta CPU en eso.
  compress: false,
  // El service worker se revisa en cada visita (si no, un sw.js viejo queda pegado días).
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
