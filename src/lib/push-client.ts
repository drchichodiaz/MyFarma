/** Web Push en el navegador: registrar el service worker y suscribir este dispositivo. */

export type PushSupport = "ok" | "unsupported" | "ios-needs-install" | "denied";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // En iPhone, Safari solo permite push si MyFarma está instalada en la pantalla de inicio.
  if (ios && !standalone) return "ios-needs-install";
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  return "ok";
}

function keyToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Pide permiso y devuelve la suscripción de este navegador (la reutiliza si ya existe). */
export async function subscribeThisDevice(vapidPublicKey: string) {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("denied");
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyToBytes(vapidPublicKey),
    }));
  const json = sub.toJSON();
  return { endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" };
}

export async function deviceIsSubscribed() {
  if (!("serviceWorker" in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return Boolean(await reg?.pushManager.getSubscription());
}
