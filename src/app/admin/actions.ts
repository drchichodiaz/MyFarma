"use server";

import { updateTag } from "next/cache";
import { requireAdmin, setReportHidden, setUserBlocked } from "@/server/services/admin";
import { TAGS } from "@/server/services/catalog";
import { createCallReports, hidePhoto } from "@/server/services/reports";
import { parseCallSheet, summarizeCall } from "@/lib/call-sheet";

function refresh(medicationIds: number[], userId?: string | null) {
  for (const id of new Set(medicationIds)) updateTag(TAGS.availability(id));
  updateTag(TAGS.overview);
  updateTag(TAGS.reports);
  if (userId) updateTag(TAGS.userReports(userId));
}

export async function setReportHiddenAction(form: FormData) {
  if (!(await requireAdmin())) return;
  const r = await setReportHidden(String(form.get("reportId")), form.get("hidden") === "1");
  refresh([r.medicationId], r.userId);
}

export async function hideReportPhotoAction(form: FormData) {
  if (!(await requireAdmin())) return;
  const r = await hidePhoto(String(form.get("reportId")));
  if (r) refresh([r.medicationId], r.userId);
}

export async function setUserBlockedAction(form: FormData) {
  const admin = await requireAdmin();
  const userId = String(form.get("userId"));
  if (!admin || userId === admin.id) return; // nadie se bloquea a sí mismo
  const meds = await setUserBlocked(
    userId,
    form.get("blocked") === "1",
    form.get("hideReports") === "1",
  );
  refresh(meds, userId);
}

export type CallSheetState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "saved"; message: string; at: number };

/** Carga rápida: guarda lo que el equipo averiguó llamando a la cadena. */
export async function saveCallSheetAction(
  _prev: CallSheetState,
  form: FormData,
): Promise<CallSheetState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "Solo un admin puede cargar reportes." };
  const parsed = parseCallSheet(form.entries());
  if (!parsed.ok) return { status: "error", message: parsed.error };

  const result = await createCallReports(admin.id, parsed.data);
  if (!result.ok) return { status: "error", message: result.error };

  refresh([parsed.data.medicationId], admin.id);
  const alerts = result.alerts ? ` Se revisan alertas por ${result.alerts} con existencia.` : "";
  return {
    status: "saved",
    message: `Guardados ${result.saved} reportes: ${summarizeCall(parsed.data.entries)}.${alerts}`,
    at: Date.now(),
  };
}
