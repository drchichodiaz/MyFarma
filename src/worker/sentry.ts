/**
 * Sentry en el worker (alertas y fotos). Sin dependencias de Next: usa @sentry/node.
 * Sin SENTRY_DSN no hace nada.
 */
import * as Sentry from "@sentry/node";
import { SENTRY_DATA_COLLECTION, scrubEvent } from "@/lib/sentry-scrub";

export const sentryEnabled = Boolean(process.env.SENTRY_DSN);

if (sentryEnabled) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? "production",
    serverName: "worker",
    dataCollection: SENTRY_DATA_COLLECTION,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  });
}

/** Un trabajo que agotó sus intentos: va a Sentry con la cola y el reporte, sin datos de personas. */
export function reportJobFailure(queue: string, reportId: string | undefined, error: Error) {
  if (!sentryEnabled) return;
  Sentry.captureException(error, { tags: { queue }, extra: { reportId } });
}

/** Antes de salir: espera a que se envíe lo pendiente (máx. 2 s). */
export const flushSentry = () => (sentryEnabled ? Sentry.flush(2000) : Promise.resolve(true));
