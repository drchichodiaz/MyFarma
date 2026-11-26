"use server";

import { refresh, updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentUser, signOut } from "@/server/auth";
import { db } from "@/server/db";
import { TAGS } from "@/server/services/catalog";
import { recomputeAvailability } from "@/server/services/reports";

export type NameState = { error?: string; saved?: boolean };

const nameSchema = z
  .string()
  .trim()
  .min(2, { error: "Escribe tu nombre." })
  .max(60, { error: "Máximo 60 letras." })
  .regex(/^[\p{L}][\p{L} '.-]*$/u, { error: "Usa solo letras." });

export async function updateName(_prev: NameState, form: FormData): Promise<NameState> {
  const user = await currentUser();
  if (!user) return { error: "Tu sesión venció. Vuelve a entrar." };
  const parsed = nameSchema.safeParse(form.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await db.user.update({ where: { id: user.id }, data: { name: parsed.data } });
  // El nombre aparece en reportes recientes e historiales.
  updateTag(TAGS.reports);
  updateTag(TAGS.availabilityAll);
  refresh();
  return { saved: true };
}

export async function doSignOut() {
  await signOut({ redirectTo: "/" });
}

/**
 * Borrar mi cuenta (derecho de cancelación, Ley 81 de 2019).
 * Se borran cuenta, sesiones, alertas, avisos y confirmaciones; los reportes se quedan
 * como "Paciente" (sin nombre) porque siguen siendo útiles para otros.
 */
export async function deleteAccount(form: FormData) {
  const user = await currentUser();
  if (!user || form.get("confirm") !== "BORRAR") return;

  const medIds = await db.$transaction(async (tx) => {
    // Sus confirmaciones desaparecen: hay que recalcular esas sucursales.
    const pairs = await tx.confirmation.findMany({
      where: { userId: user.id },
      select: { report: { select: { branchId: true, medicationId: true } } },
    });
    await tx.user.delete({ where: { id: user.id } });
    const unique = new Map(pairs.map(({ report: r }) => [`${r.branchId}:${r.medicationId}`, r]));
    for (const r of unique.values()) await recomputeAvailability(tx, r.branchId, r.medicationId);
    return [...new Set([...unique.values()].map((r) => r.medicationId))];
  });

  for (const id of medIds) updateTag(TAGS.availability(id));
  updateTag(TAGS.reports);
  updateTag(TAGS.availabilityAll);
  // La sesión ya no existe en la base; se borra también la cookie.
  const jar = await cookies();
  for (const name of ["authjs.session-token", "__Secure-authjs.session-token"]) jar.delete(name);
  redirect("/?cuenta=borrada");
}
