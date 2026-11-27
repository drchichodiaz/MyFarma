/** Punto por defecto mientras el usuario no comparte su ubicación: Vía España, El Carmen. */
export const DEFAULT_LOCATION = { lat: 8.9897, lng: -79.5287, label: "Vía España" } as const;

/** Radio de búsqueda por defecto, en metros. */
export const DEFAULT_RADIUS_M = 15_000;

/**
 * Cookie con la ubicación que el usuario compartió ("8.991,-79.521", redondeada a ~100 m).
 * Vive solo en su navegador (30 días); el servidor la lee para ordenar por distancia y no la guarda.
 */
export const LOCATION_COOKIE = "myfarma-loc";
export const LOCATION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Límites aproximados de Panamá, para descartar coordenadas absurdas. */
const BOUNDS = { minLat: 7, maxLat: 9.8, minLng: -83.1, maxLng: -77.1 };

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Coordenadas válidas dentro de Panamá, redondeadas a 3 decimales (~100 m), o null. */
export function toPoint(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const la = Number(lat);
  const ln = Number(lng);
  const valid =
    lat !== "" &&
    lng !== "" &&
    lat != null &&
    lng != null &&
    Number.isFinite(la) &&
    Number.isFinite(ln) &&
    la >= BOUNDS.minLat &&
    la <= BOUNDS.maxLat &&
    ln >= BOUNDS.minLng &&
    ln <= BOUNDS.maxLng;
  return valid ? { lat: round3(la), lng: round3(ln) } : null;
}

/** Valor de la cookie de ubicación → punto, o null si falta o no es válido. */
export function parseLocationCookie(value: string | null | undefined) {
  if (!value) return null;
  const [lat, lng] = decodeURIComponent(value).split(",");
  return toPoint(lat, lng);
}

/** Punto → valor de la cookie ("8.991,-79.521"). */
export const formatLocationCookie = (p: { lat: number; lng: number }) =>
  `${round3(p.lat)},${round3(p.lng)}`;

/**
 * Ubicación para una búsqueda: lat/lng de la URL (un enlace compartido manda), si no la cookie
 * que guardó el usuario, si no Vía España. Redondea a ~100 m para que usuarios cercanos
 * compartan la misma entrada de caché.
 */
export function parseLocation(
  params: Record<string, string | string[] | undefined>,
  cookieValue?: string | null,
) {
  const point = toPoint(params.lat, params.lng) ?? parseLocationCookie(cookieValue);
  if (!point) return { ...DEFAULT_LOCATION, isDefault: true };
  return { ...point, label: "tu ubicación", isDefault: false };
}
