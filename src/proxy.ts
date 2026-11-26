import { NextResponse, type NextRequest } from "next/server";
import { Pool } from "pg";

/**
 * 404 de verdad para medicamentos, sucursales y condiciones que no existen.
 *
 * Con Cache Components la página empieza a enviarse (200) antes de saber si el slug existe,
 * así que un notFound() dentro de la página solo agrega noindex. Proxy corre antes de renderizar:
 * aquí sí se puede responder 404. Los slugs válidos se guardan en memoria y se refrescan cada
 * 5 minutos (son unos cientos). Si la base no responde, se deja pasar: la página igual muestra
 * "no encontrado" con noindex.
 */

type Slugs = { meds: Set<string>; branches: Set<string>; conditions: Set<string>; at: number };

const TTL_MS = 5 * 60_000;
/** Ante un slug desconocido se vuelve a consultar, pero no más de una vez cada 30 s. */
const RECHECK_MS = 30_000;

let pool: Pool | null = null;
let slugs: Slugs | null = null;
let loading: Promise<Slugs | null> | null = null;

async function load(): Promise<Slugs | null> {
  if (!process.env.DATABASE_URL) return null;
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 2_000,
    idleTimeoutMillis: 60_000,
  });
  try {
    const { rows } = await pool.query<{ kind: string; slug: string }>(`
      SELECT 'm' AS kind, slug FROM medications
      UNION ALL SELECT 'b', slug FROM branches
      UNION ALL SELECT 'c', slug FROM conditions`);
    const next: Slugs = {
      meds: new Set(),
      branches: new Set(),
      conditions: new Set(),
      at: Date.now(),
    };
    for (const r of rows) {
      (r.kind === "m" ? next.meds : r.kind === "b" ? next.branches : next.conditions).add(r.slug);
    }
    slugs = next;
    return next;
  } catch {
    return slugs; // sin base: seguimos con lo último que sabíamos (o nada)
  }
}

async function current(forceIfOlderThan = TTL_MS) {
  if (slugs && Date.now() - slugs.at < forceIfOlderThan) return slugs;
  loading ??= load().finally(() => (loading = null));
  return loading;
}

function exists(s: Slugs, [section, a, b]: string[]) {
  if (section === "m") return s.meds.has(a!) && (b === undefined || s.branches.has(b));
  if (section === "c") return s.conditions.has(a!);
  return true;
}

export async function proxy(request: NextRequest) {
  const parts = request.nextUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  // Solo /m/<med>, /m/<med>/<sucursal> y /c/<condición>.
  if (parts.length < 2 || parts.length > 3 || (parts[0] === "c" && parts.length !== 2)) {
    return NextResponse.next();
  }
  // /m/<med>/opengraph-image es la vista previa del medicamento, no una sucursal.
  if (parts.length === 3 && /^(opengraph|twitter)-image/.test(parts[2]!)) {
    parts.pop();
  }
  let s = await current();
  if (s && !exists(s, parts)) s = await current(RECHECK_MS); // ¿se agregó hace poco?
  if (!s || exists(s, parts)) return NextResponse.next();
  return NextResponse.rewrite(new URL("/no-encontrado", request.url), { status: 404 });
}

export const config = { matcher: ["/m/:path+", "/c/:path+"] };
