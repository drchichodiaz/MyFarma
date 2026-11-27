import { withSentryConfig } from "@sentry/nextjs/config";
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

/**
 * Sentry: los source maps se suben solo si hay SENTRY_AUTH_TOKEN (el build de la imagen en el CI)
 * y se borran del resultado después de subirlos, para no publicarlos.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
  // Menos JS en el navegador: sin mensajes de depuración ni código de Session Replay (no lo usamos).
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
});
