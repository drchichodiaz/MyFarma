import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import { env } from "@/lib/env";
import { db } from "@/server/db";

export type PushPayload = { title: string; body: string; url: string; tag: string };

let configured = false;
function setup() {
  if (configured) return;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) throw new Error("Faltan las claves VAPID");
  setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
}

/**
 * Envía a todos los navegadores del usuario. Borra las suscripciones que el navegador
 * ya dio de baja (404/410). Devuelve cuántas recibieron el aviso.
 */
export async function pushToUser(userId: string, payload: PushPayload): Promise<number> {
  setup();
  const subs = await db.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  let delivered = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 6 * 60 * 60, urgency: "high", timeout: 10_000 },
        );
        delivered++;
        await db.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        } else {
          console.warn("push:", status, (error as Error).message);
        }
      }
    }),
  );
  return delivered;
}
