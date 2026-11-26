/**
 * Reglas puras para cargar sucursales reales: slugs, nombre corto, horario compacto y
 * validación de las filas de `prisma/seed/data/branches.csv`.
 * Las usan el seed (validar antes de escribir en la DB) y `scripts/import-branches.ts`.
 * Sin dependencias de Next ni de la DB.
 */
import { z } from "zod";
import { normalize } from "./text";

/** "Farmacias Arrocha | Vía Argentina" → "farmacias-arrocha-via-argentina" */
export function slugify(input: string): string {
  return normalize(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SEPARATOR = /\s*[|⎮/–—•·]\s*|\s+-\s+/;

/**
 * Nombre corto de la sucursal ("Los Pueblos") a partir del nombre de Google.
 * Quita el nombre de la cadena y los separadores; si no queda nada, usa la zona.
 */
export function branchShortName(fullName: string, chainWords: RegExp, zone: string): string {
  const parts = fullName.split(SEPARATOR).filter(Boolean);
  const rest = (parts.length > 1 ? parts.slice(1).join(" ") : fullName.replace(chainWords, ""))
    .replace(chainWords, "")
    .replace(/^(farmacias?|del?|la|el)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return rest.length >= 3 ? rest : zone;
}

/**
 * Farmacia independiente: la "cadena" es su nombre comercial y la sucursal, lo que va
 * después del separador o la zona. "Farmacia Lourdes" en Betania → ("Farmacia Lourdes", "Betania").
 */
export function independentNames(fullName: string, zone: string) {
  const [head, ...tail] = fullName.split(SEPARATOR).filter(Boolean);
  const chain = (head ?? fullName).replace(/\s+/g, " ").trim();
  const branch = tail.join(" ").trim();
  return { chain, branch: branch.length >= 3 ? branch : zone };
}

const DAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;
const SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

/**
 * Horario de Google ("lunes: 7:00–21:00 | martes: …") → texto corto para la ficha.
 *   todos iguales         → "Lun–Dom 7:00–21:00"
 *   24 h todos los días   → "Abierta 24 horas"
 *   distintos             → "Lun–Sáb 7:00–21:00 · Dom 8:00–18:00"
 * Si el texto no tiene los 7 días reconocibles, se devuelve tal cual (o null si viene vacío).
 */
export function compactHours(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const byDay = new Map<string, string>();
  for (const part of text.split("|")) {
    const m = part.trim().match(/^([a-záéíóú]+):\s*(.+)$/i);
    if (m) byDay.set(m[1]!.toLowerCase(), m[2]!.trim());
  }
  const values = DAYS.map((d) => byDay.get(d));
  if (values.some((v) => !v)) return text;

  const label = (v: string) =>
    /24\s*horas/i.test(v) ? "24 horas" : /cerrad/i.test(v) ? "cerrado" : v.replace(/\s+/g, " ");
  const labels = values.map((v) => label(v!));
  if (labels.every((l) => l === "24 horas")) return "Abierta 24 horas";

  const groups: { from: number; to: number; hours: string }[] = [];
  labels.forEach((hours, i) => {
    const last = groups.at(-1);
    if (last && last.hours === hours) last.to = i;
    else groups.push({ from: i, to: i, hours });
  });
  return groups
    .filter((g) => g.hours !== "cerrado")
    .map((g) => {
      const days = g.from === g.to ? SHORT[g.from] : `${SHORT[g.from]}–${SHORT[g.to]}`;
      return `${days} ${g.hours}`;
    })
    .join(" · ");
}

/** Límites aproximados de Panamá (los mismos que `parseLocation`). */
const PANAMA = { minLat: 7, maxLat: 9.8, minLng: -83.1, maxLng: -77.1 };

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "solo minúsculas, números y guiones")
  .max(80);

/** Una fila de `branches.csv` tal como sale del parser (todo texto). */
export const branchRowSchema = z.object({
  slug,
  chain: slug,
  name: z.string().min(2).max(80),
  address: z.string().min(3).max(200),
  phone: z
    .string()
    .regex(/^(\+507 \d{3,4}-\d{4})?$/, "formato +507 0000-0000")
    .default(""),
  hours: z.string().max(120).default(""),
  lat: z.coerce.number().min(PANAMA.minLat).max(PANAMA.maxLat),
  lng: z.coerce.number().min(PANAMA.minLng).max(PANAMA.maxLng),
  verified: z.enum(["true", "false"]),
  place_id: z
    .string()
    .regex(/^[A-Za-z0-9_-]{10,}$/, "place_id inválido")
    .or(z.literal(""))
    .default(""),
});
export type BranchRow = z.infer<typeof branchRowSchema>;

export const chainRowSchema = z.object({
  slug,
  name: z.string().min(2).max(60),
  website: z.string().url().or(z.literal("")).default(""),
  color: z.enum(["teal", "yellow", "salmon", "pink", "blue", "sun", "lime"]),
});
export type ChainRow = z.infer<typeof chainRowSchema>;

/**
 * Valida todas las filas a la vez y devuelve la lista de errores legibles (vacía si todo está bien):
 * formato de cada fila, slugs y place_id repetidos, cadenas que no existen.
 */
export function validateBranchRows(rows: unknown[], chainSlugs: Iterable<string>): string[] {
  const chains = new Set(chainSlugs);
  const errors: string[] = [];
  const seenSlug = new Map<string, number>();
  const seenPlace = new Map<string, number>();
  rows.forEach((raw, i) => {
    const line = i + 2; // +1 por el encabezado, +1 porque las filas empiezan en 1
    const parsed = branchRowSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`fila ${line}: ${issue.path.join(".")} — ${issue.message}`);
      }
      return;
    }
    const r = parsed.data;
    if (!chains.has(r.chain)) errors.push(`fila ${line}: cadena desconocida "${r.chain}"`);
    const dupSlug = seenSlug.get(r.slug);
    if (dupSlug) errors.push(`fila ${line}: slug "${r.slug}" repetido (fila ${dupSlug})`);
    else seenSlug.set(r.slug, line);
    if (r.place_id) {
      const dupPlace = seenPlace.get(r.place_id);
      if (dupPlace) errors.push(`fila ${line}: place_id repetido (fila ${dupPlace})`);
      else seenPlace.set(r.place_id, line);
    }
  });
  return errors;
}
