"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { MAX_UPLOAD_BYTES, UPLOAD_TYPES } from "@/lib/photos";
import { parsePrice } from "@/lib/price";
import { currentUser } from "@/server/auth";
import { TAGS } from "@/server/services/catalog";
import { limit } from "@/server/rate-limit";
import {
  confirmReport,
  createReport,
  hidePhoto,
  LIMITS,
  uploadPrefix,
} from "@/server/services/reports";
import { photosEnabled, presignUpload } from "@/server/storage";

export type ReportState =
  | { status: "idle" }
  | { status: "error"; message: string; field?: "branch" | "price" | "medication" }
  | { status: "ok"; reportId: string };

const schema = z.object({
  medicationId: z.coerce.number().int().positive(),
  branchId: z.coerce.number().int().positive(),
  status: z.enum(["AVAILABLE", "LOW", "OUT"]),
});

export async function submitReport(_prev: ReportState, form: FormData): Promise<ReportState> {
  const user = await currentUser();
  if (!user)
    return { status: "error", message: "Tu sesión venció. Vuelve a entrar para reportar." };

  if (!form.get("branchId")) {
    return {
      status: "error",
      field: "branch",
      message: "Elige la sucursal para que otros sepan a dónde ir.",
    };
  }
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return {
      status: "error",
      field: "medication",
      message: "Revisa el medicamento y la sucursal.",
    };
  }
  const priceCents =
    parsed.data.status === "OUT" ? null : parsePrice(String(form.get("price") ?? ""));
  if (Number.isNaN(priceCents)) {
    return {
      status: "error",
      field: "price",
      message: "Escribe el precio en balboas, por ejemplo 15.20 (o déjalo vacío).",
    };
  }

  const photoKey = String(form.get("photoKey") ?? "") || null;
  const result = await createReport(user.id, { ...parsed.data, priceCents, photoKey });
  if (!result.ok) {
    const message = {
      rate_pair: `Ya reportaste esta sucursal hace poco. Puedes volver a reportarla en ${Math.ceil((result.retryAfterSec ?? 60) / 60)} min.`,
      rate_hour: `Llegaste al máximo de ${LIMITS.reportsPerHour} reportes por hora. Gracias por ayudar tanto; intenta más tarde.`,
      not_found: "Ese medicamento o esa sucursal ya no existe.",
      bad_photo: "La foto no terminó de subir. Quítala y vuelve a elegirla.",
    }[result.error];
    return { status: "error", message };
  }

  updateTag(TAGS.availability(result.medicationId));
  updateTag(TAGS.overview);
  updateTag(TAGS.reports);
  updateTag(TAGS.userReports(user.id));
  return { status: "ok", reportId: result.reportId };
}

export type ConfirmState = { error?: string; done?: boolean };

export async function submitConfirmation(
  _prev: ConfirmState,
  form: FormData,
): Promise<ConfirmState> {
  const user = await currentUser();
  if (!user) return { error: "Entra para confirmar." };
  const reportId = String(form.get("reportId") ?? "");
  const agrees = form.get("agrees") === "1";

  const result = await confirmReport(user.id, reportId, agrees);
  if (!result.ok) {
    return {
      error: {
        rate_hour: "Llegaste al máximo de confirmaciones por hora.",
        not_found: "Ese reporte ya no está disponible.",
        own_report: "Es tu propio reporte: otra persona tiene que confirmarlo.",
        not_current: "Alguien reportó algo más nuevo. Recarga la página.",
      }[result.error],
    };
  }
  updateTag(TAGS.availability(result.medicationId));
  updateTag(TAGS.overview);
  updateTag(TAGS.userReports(user.id));
  return { done: true };
}

export type UploadTicket = { ok: true; key: string; url: string } | { ok: false; error: string };

const ticketSchema = z.object({
  type: z.enum(UPLOAD_TYPES),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

/**
 * URL firmada para subir la foto directo a R2 (no pasa por el servidor).
 * Solo con sesión, tipo y tamaño exactos, y como máximo 20 por hora.
 */
export async function requestPhotoUpload(input: {
  type: string;
  size: number;
}): Promise<UploadTicket> {
  if (!photosEnabled) return { ok: false, error: "Las fotos todavía no están disponibles." };
  const user = await currentUser();
  if (!user) return { ok: false, error: "Tu sesión venció. Vuelve a entrar." };
  const parsed = ticketSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "La foto es demasiado grande o no es una imagen." };
  const rl = await limit(`upload:user:${user.id}`, 20, 60 * 60);
  if (!rl.ok) return { ok: false, error: "Subiste muchas fotos seguidas. Intenta en un rato." };

  const ext = parsed.data.type === "image/webp" ? "webp" : "jpg";
  const key = `${uploadPrefix(user.id)}${crypto.randomUUID()}.${ext}`;
  const url = await presignUpload(key, parsed.data.type, parsed.data.size);
  return { ok: true, key, url };
}

/** Moderación: solo ADMIN. */
export async function hidePhotoAction(form: FormData) {
  const user = await currentUser();
  if (user?.role !== "ADMIN") return;
  const result = await hidePhoto(String(form.get("reportId") ?? ""));
  if (!result) return;
  updateTag(TAGS.availability(result.medicationId));
  if (result.userId) updateTag(TAGS.userReports(result.userId));
}
