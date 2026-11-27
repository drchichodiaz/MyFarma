/**
 * Sentry en el navegador: errores de JavaScript y una muestra de cargas lentas (Web Vitals).
 * Se carga cuando el navegador queda libre, para no frenar el primer render (src/lib/sentry-client).
 * El DSN entra al construir la imagen (NEXT_PUBLIC_SENTRY_DSN); sin él no se descarga nada.
 * Sin Session Replay: no grabamos lo que hace cada persona.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  const start = () => void import("./lib/sentry-client").then((m) => m.initSentry(dsn));
  if ("requestIdleCallback" in window) requestIdleCallback(start, { timeout: 4000 });
  else setTimeout(start, 2000);
}
