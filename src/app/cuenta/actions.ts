"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { currentUser, signOut } from "@/server/auth";
import { db } from "@/server/db";
import { TAGS } from "@/server/services/catalog";

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
