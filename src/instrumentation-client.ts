/**
 * Sentry en el navegador: errores de JavaScript y una muestra de navegaciones lentas.
 * El DSN entra al construir la imagen (NEXT_PUBLIC_SENTRY_DSN); sin él no se envía nada.
 * Sin Session Replay: no grabamos lo que hace cada persona.
 */
import * as Sentry from "@sentry/nextjs";
import { SENTRY_DATA_COLLECTION, scrubEvent, SENTRY_TRACES_SAMPLE_RATE } from "@/lib/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "production",
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
    dataCollection: SENTRY_DATA_COLLECTION,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
    // Ruido de extensiones del navegador y de redes caídas: no son errores nuestros.
    ignoreErrors: ["ResizeObserver loop", "Load failed", "Failed to fetch", "NetworkError"],
    denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-extension:\/\//],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
