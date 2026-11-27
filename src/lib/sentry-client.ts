/**
 * Sentry del navegador, cargado aparte (import dinámico): la página se pinta y queda usable sin
 * esperar sus ~65 KB, que bajan cuando el navegador queda libre. Solo para el cliente.
 */
import * as Sentry from "@sentry/nextjs";
import { SENTRY_DATA_COLLECTION, scrubEvent, SENTRY_TRACES_SAMPLE_RATE } from "./sentry-scrub";

export function initSentry(dsn: string) {
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

export const captureException = (error: unknown) => Sentry.captureException(error);
