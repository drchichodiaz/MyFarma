/**
 * Sentry en el servidor: errores de páginas, acciones y rutas, y una muestra de peticiones lentas.
 * Sin SENTRY_DSN (desarrollo, CI, build) no hace nada.
 */
import * as Sentry from "@sentry/nextjs";
import { SENTRY_DATA_COLLECTION, scrubEvent, SENTRY_TRACES_SAMPLE_RATE } from "@/lib/sentry-scrub";

export function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? "production",
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
    // Nada de usuario, IP, cookies, cabeceras ni cuerpos; scrubEvent además limpia las URL.
    dataCollection: SENTRY_DATA_COLLECTION,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
  });
}

export const onRequestError = Sentry.captureRequestError;
