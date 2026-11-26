"use server";

import { updateTag } from "next/cache";
import { requireAdmin, setReportHidden, setUserBlocked } from "@/server/services/admin";
import { TAGS } from "@/server/services/catalog";
import { hidePhoto } from "@/server/services/reports";

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
