/**
 * Lo que sale hacia Sentry pasa por aquí: nunca la ubicación, cookies, cabeceras, IP ni datos de
 * la persona. Sin dependencias de Next: lo usan la web (servidor y navegador) y el worker.
 */

/** Parámetros de URL que pueden identificar a alguien (ubicación) o son secretos (enlaces de baja). */
const SENSITIVE_PARAMS = /^(lat|lng|token|t|sig|code|email)$/i;

/** Quita los parámetros sensibles de una URL (absoluta o relativa). Si no se puede leer, la deja. */
export function scrubUrl(url: string): string {
  const q = url.indexOf("?");
  if (q < 0) return url;
  const hash = url.indexOf("#", q);
  const base = url.slice(0, q);
  const query = url.slice(q + 1, hash < 0 ? undefined : hash);
  const params = new URLSearchParams(query);
  for (const key of [...params.keys()]) {
    if (SENSITIVE_PARAMS.test(key)) params.set(key, "[filtrado]");
  }
  const qs = params.toString();
  return base + (qs ? `?${qs}` : "") + (hash < 0 ? "" : url.slice(hash));
}

type Scrubbable = {
  request?: {
    url?: string;
    query_string?: unknown;
    cookies?: unknown;
    headers?: unknown;
    data?: unknown;
  };
  user?: unknown;
  breadcrumbs?: { data?: Record<string, unknown> }[];
  transaction?: string;
};

/** beforeSend / beforeSendTransaction: limpia el evento y lo deja pasar. */
export function scrubEvent<T extends Scrubbable>(event: T): T {
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
  }
  delete event.user;
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  for (const crumb of event.breadcrumbs ?? []) {
    for (const key of ["url", "from", "to"] as const) {
      const value = crumb.data?.[key];
      if (typeof value === "string") crumb.data![key] = scrubUrl(value);
    }
  }
  return event;
}

/**
 * `dataCollection` de Sentry v11: por defecto el SDK recoge usuario, cookies, cabeceras, cuerpos y
 * query params. Aquí todo apagado salvo los query params no sensibles (útiles para reproducir).
 */
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [] as never[],
  urlQueryParams: { deny: ["lat", "lng", "t", "token", "sig", "code", "email"] },
};

/** Muestras de rendimiento: 10 % alcanza para ver lo lento sin gastar la cuota gratis. */
export const SENTRY_TRACES_SAMPLE_RATE = 0.1;
