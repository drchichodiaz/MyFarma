/** Punto por defecto mientras el usuario no comparte su ubicación: Vía España, El Carmen. */
export const DEFAULT_LOCATION = { lat: 8.9897, lng: -79.5287, label: "Vía España" } as const;

/** Radio de búsqueda por defecto, en metros. */
export const DEFAULT_RADIUS_M = 15_000;

/** Límites aproximados de Panamá, para descartar coordenadas absurdas. */
const BOUNDS = { minLat: 7, maxLat: 9.8, minLng: -83.1, maxLng: -77.1 };

/**
 * Lee lat/lng de los searchParams. Redondea a 3 decimales (~100 m) para que
 * usuarios cercanos compartan la misma entrada de caché.
 */
export function parseLocation(params: Record<string, string | string[] | undefined>) {
  const lat = Number(params.lat);
  const lng = Number(params.lng);
  const valid =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= BOUNDS.minLat &&
    lat <= BOUNDS.maxLat &&
    lng >= BOUNDS.minLng &&
    lng <= BOUNDS.maxLng;
  if (!valid) return { ...DEFAULT_LOCATION, isDefault: true };
  return {
    lat: Math.round(lat * 1000) / 1000,
    lng: Math.round(lng * 1000) / 1000,
    label: "tu ubicación",
    isDefault: false,
  };
}
