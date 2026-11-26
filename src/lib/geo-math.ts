/** Distancia en km entre dos puntos (haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Posición de un punto en el radar, en % desde el centro (50,50).
 * `maxKm` es el borde del radar. Norte arriba, este a la derecha.
 */
export function radarPosition(
  center: { lat: number; lng: number },
  p: { lat: number; lng: number },
  maxKm: number,
) {
  const x = (p.lng - center.lng) * 111.32 * Math.cos((center.lat * Math.PI) / 180);
  const y = (p.lat - center.lat) * 110.57;
  return { left: 50 + (x / maxKm) * 50, top: 50 - (y / maxKm) * 50 };
}
