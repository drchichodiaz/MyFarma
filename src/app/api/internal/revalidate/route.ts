import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";

const body = z.object({
  tags: z
    .array(z.string().regex(/^(availability:\d+|reports:user:[a-z0-9]+|reports)$/))
    .min(1)
    .max(5),
});

function authorized(header: string | null) {
  if (!env.INTERNAL_SECRET || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(env.INTERNAL_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** POST /api/internal/revalidate — el worker avisa que una foto quedó lista. */
export async function POST(request: Request) {
  if (!authorized(request.headers.get("x-internal-secret"))) {
    return new Response("No autorizado", { status: 401 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("Datos inválidos", { status: 400 });
  for (const tag of parsed.data.tags) revalidateTag(tag, { expire: 0 });
  return Response.json({ ok: true });
}
