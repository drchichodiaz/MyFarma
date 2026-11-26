/**
 * Enlace "Cómo llegar" a Google Maps (URL pública de Maps, sin API key ni rastreo en nuestra página).
 * Con place_id abre la ficha exacta de la farmacia; sin él, el punto en el mapa.
 * Sin dependencias de Next: lo usan la web y el worker.
 */
export function directionsUrl(b: { lat: number; lng: number; placeId?: string | null }) {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", `${b.lat},${b.lng}`);
  if (b.placeId) url.searchParams.set("query_place_id", b.placeId);
  return url.toString();
}
