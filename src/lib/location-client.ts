/**
 * Ubicación del usuario en el navegador: pedirla, guardarla en la cookie `myfarma-loc`
 * (redondeada a ~100 m, 30 días) y avisar a los componentes que la muestran.
 * Solo para componentes de cliente.
 */
import { useSyncExternalStore } from "react";
import { track } from "./analytics";
import {
  formatLocationCookie,
  LOCATION_COOKIE,
  LOCATION_COOKIE_MAX_AGE,
  parseLocationCookie,
  toPoint,
} from "./geo";

type Point = { lat: number; lng: number };
const EVENT = "myfarma:location";

function readCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCATION_COOKIE}=([^;]*)`));
  return match ? match[1]! : null;
}

export function saveLocation(p: Point) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCATION_COOKIE}=${encodeURIComponent(formatLocationCookie(p))}; Path=/; Max-Age=${LOCATION_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(EVENT));
}

export function forgetLocation() {
  document.cookie = `${LOCATION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  window.dispatchEvent(new Event(EVENT));
}

const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
};

/**
 * La cookie como texto (estable entre renders). En el servidor y al hidratar vale null:
 * así el HTML del servidor y el primer render del cliente coinciden.
 */
export function useStoredLocationRaw() {
  return useSyncExternalStore(subscribe, readCookie, () => null);
}

export function useStoredLocation(): Point | null {
  return parseLocationCookie(useStoredLocationRaw());
}

export class LocationError extends Error {}

/** Pide la ubicación al navegador. Rechaza con un mensaje listo para mostrar. */
export function requestLocation(): Promise<Point> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new LocationError("Tu navegador no permite compartir ubicación."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(
          new LocationError(
            err.code === err.PERMISSION_DENIED
              ? "No diste permiso de ubicación. Puedes activarlo en tu navegador."
              : "No pudimos obtener tu ubicación. Intenta de nuevo.",
          ),
        ),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  });
}

/** Pide la ubicación y la guarda. Fuera de Panamá no sirve para buscar: se avisa y no se guarda. */
export async function locateAndSave(): Promise<Point> {
  const raw = await requestLocation();
  const point = toPoint(raw.lat, raw.lng);
  if (!point) throw new LocationError("Tu ubicación parece estar fuera de Panamá.");
  saveLocation(point);
  track("ubicacion");
  return point;
}
