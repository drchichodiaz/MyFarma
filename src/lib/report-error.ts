/**
 * Avisa a Sentry de un error que atrapó un error boundary. Carga Sentry solo si hace falta
 * (import dinámico): las páginas sin errores no pagan su peso. Solo para el cliente.
 */
export function reportError(error: unknown) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  void import("./sentry-client").then((m) => m.captureException(error)).catch(() => {});
}
