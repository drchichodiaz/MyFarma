import "server-only";
import { z } from "zod";

/** Variables de entorno del servidor, validadas una sola vez al arrancar. */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default("MyFarma <no-reply@myfarma.local>"),
  /** Sin estas dos, el botón de Google no aparece (desarrollo y CI sin credenciales). */
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  /** Fotos de reportes (F2b). Sin estas, el paso de foto no aparece. */
  R2_ACCOUNT_ID: z.string().optional(),
  R2_PHOTOS_ACCESS_KEY_ID: z.string().optional(),
  R2_PHOTOS_SECRET_ACCESS_KEY: z.string().optional(),
  R2_UPLOADS_BUCKET: z.string().default("myfarma-uploads"),
  R2_PHOTOS_BUCKET: z.string().default("myfarma-photos"),
  PHOTOS_PUBLIC_URL: z.url().default("https://img.myfarma.net"),
  /** Secreto compartido entre el worker y la app (POST /api/internal/revalidate). */
  INTERNAL_SECRET: z.string().min(16).optional(),
  /** Dónde el worker encuentra la app (red interna de Docker en producción). */
  APP_INTERNAL_URL: z.url().default("http://localhost:3000"),
});

export const env = schema.parse(process.env);
