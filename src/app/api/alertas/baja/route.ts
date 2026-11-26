import { revalidateTag } from "next/cache";
import { deactivateAlertByToken } from "@/server/services/alerts";
import { TAGS } from "@/server/services/catalog";

/**
 * POST de un clic (RFC 8058): el botón "Cancelar suscripción" de Gmail llama aquí
 * con el enlace firmado del encabezado List-Unsubscribe.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const alert = await deactivateAlertByToken(
    url.searchParams.get("a") ?? "",
    url.searchParams.get("t") ?? "",
  );
  if (!alert) return new Response("Enlace no válido", { status: 400 });
  revalidateTag(TAGS.userAlerts(alert.userId), { expire: 0 });
  return new Response("Alerta desactivada", { status: 200 });
}
