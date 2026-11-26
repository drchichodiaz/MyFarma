import "server-only";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { connection } from "next/server";
import { cache } from "react";
import { env } from "@/lib/env";
import { db } from "@/server/db";
import { sendSignInLink } from "@/server/mail";
import { limit } from "@/server/rate-limit";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      image?: string | null;
      role: "USER" | "ADMIN";
      /** Bloqueado por moderación: no puede reportar, confirmar ni crear alertas. */
      blocked: boolean;
    };
  }
}

const ADMIN_EMAILS = new Set(
  (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

const providers: Provider[] = [
  Nodemailer({
    server: {}, // el envío lo hace sendSignInLink con nuestro transporte
    from: env.EMAIL_FROM,
    maxAge: 24 * 60 * 60,
    async sendVerificationRequest({ identifier, url }) {
      // Máximo 5 enlaces por hora por correo: evita usar el formulario para mandar spam.
      const rl = await limit(`signin:${identifier}`, 5, 60 * 60);
      if (!rl.ok) throw new Error("Demasiados enlaces pedidos para este correo");
      await sendSignInLink(identifier, url);
    },
  }),
];

if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  // Google verifica el correo, así que es seguro unirlo a una cuenta creada por enlace.
  providers.unshift(Google({ allowDangerousEmailAccountLinking: true }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers,
  session: { strategy: "database", maxAge: 60 * 60 * 24 * 60, updateAge: 60 * 60 * 24 },
  // Detrás de Caddy + Cloudflare: el host lo fija AUTH_URL en producción.
  trustHost: true,
  pages: { signIn: "/entrar", verifyRequest: "/entrar/revisa", error: "/entrar" },
  callbacks: {
    // Solo lo necesario: nunca el correo en la sesión que llega a la UI.
    session({ session, user }) {
      const u = user as typeof user & { role: "USER" | "ADMIN"; blockedAt: Date | null };
      return {
        expires: session.expires,
        user: { id: u.id, name: u.name, image: u.image, role: u.role, blocked: !!u.blockedAt },
      } as typeof session;
    },
  },
  events: {
    // Los correos de ADMIN_EMAILS quedan como admin al entrar (no hay que tocar la base a mano).
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (user.id && email && ADMIN_EMAILS.has(email)) {
        await db.user.updateMany({ where: { id: user.id, role: "USER" }, data: { role: "ADMIN" } });
      }
    },
  },
});

/** Usuario que puede aportar (reportar, confirmar, alertas): con sesión y sin bloqueo. */
export async function contributor() {
  const user = await currentUser();
  if (!user) return { user: null, error: "Tu sesión venció. Vuelve a entrar." } as const;
  if (user.blocked) {
    return {
      user: null,
      error: "Tu cuenta está suspendida por moderación. Escríbenos a hola@myfarma.net.",
    } as const;
  }
  return { user, error: null } as const;
}

export const hasGoogle = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);

/**
 * Usuario actual o null. Lee la cookie: va siempre dentro de un <Suspense>.
 * connection() primero: Auth.js usa crypto antes de leer la cookie, y eso no puede
 * pasar durante el prerender.
 */
export const currentUser = cache(async () => {
  await connection();
  return (await auth())?.user ?? null;
});
