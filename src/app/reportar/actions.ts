"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { parsePrice } from "@/lib/price";
import { currentUser } from "@/server/auth";
import { TAGS } from "@/server/services/catalog";
import { confirmReport, createReport, LIMITS } from "@/server/services/reports";

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

  const result = await createReport(user.id, { ...parsed.data, priceCents });
  if (!result.ok) {
    const message = {
      rate_pair: `Ya reportaste esta sucursal hace poco. Puedes volver a reportarla en ${Math.ceil((result.retryAfterSec ?? 60) / 60)} min.`,
      rate_hour: `Llegaste al máximo de ${LIMITS.reportsPerHour} reportes por hora. Gracias por ayudar tanto; intenta más tarde.`,
      not_found: "Ese medicamento o esa sucursal ya no existe.",
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
