import "server-only";
import { z } from "zod";

/** Variables de entorno del servidor, validadas una sola vez al arrancar. */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().default(1025),
  EMAIL_FROM: z.string().default("MyFarma <no-reply@myfarma.local>"),
});

export const env = schema.parse(process.env);
