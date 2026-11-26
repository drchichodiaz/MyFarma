"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { safeNext } from "@/lib/redirect";
import { signIn } from "@/server/auth";

export type EmailState = { error?: string; email?: string };

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safeNext(formData.get("next")) });
}

const emailSchema = z.email({ error: "Escribe un correo válido, por ejemplo nombre@gmail.com." });

export async function signInWithEmail(_prev: EmailState, formData: FormData): Promise<EmailState> {
  const raw = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email: raw };

  try {
    // Lanza un redirect a /entrar/revisa cuando el correo sale bien.
    await signIn("nodemailer", { email: parsed.data, redirectTo: safeNext(formData.get("next")) });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        email: raw,
        error:
          "No pudimos enviar el enlace. Si pediste varios seguidos, espera una hora; si no, intenta de nuevo en un momento.",
      };
    }
    throw error; // el redirect de Next
  }
  return {};
}
