import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { normalize } from "@/lib/text";

/** Etiquetas de caché. Los reportes (F2) invalidan `availability:<id>`. */
export const TAGS = {
  catalog: "catalog",
  availability: (medicationId: number) => `availability:${medicationId}`,
  availabilityAll: "availability",
  /** Resumen de "Escaseando hoy" (portada). */
  overview: "availability:overview",
  reports: "reports",
  userReports: (userId: string) => `reports:user:${userId}`,
} as const;

export type MedicationSummary = {
  id: number;
  slug: string;
  activeIngredient: string;
  strength: string;
  form: string;
  pack: string | null;
  requiresRx: boolean;
  scarceInCss: boolean;
  /** Color de la primera condición (para el cuadro pastel y la caja dibujada). */
  color: string;
  conditionName: string | null;
};

const medicationSelect = {
  id: true,
  slug: true,
  activeIngredient: true,
  strength: true,
  form: true,
  pack: true,
  requiresRx: true,
  scarceInCss: true,
  conditions: {
    select: { condition: { select: { name: true, color: true, sort: true } } },
    orderBy: { condition: { sort: "asc" } },
    take: 1,
  },
} satisfies Prisma.MedicationSelect;

type MedicationRow = Prisma.MedicationGetPayload<{ select: typeof medicationSelect }>;

function toSummary(m: MedicationRow): MedicationSummary {
  const first = m.conditions[0]?.condition;
  return {
    id: m.id,
    slug: m.slug,
    activeIngredient: m.activeIngredient,
    strength: m.strength,
    form: m.form,
    pack: m.pack,
    requiresRx: m.requiresRx,
    scarceInCss: m.scarceInCss,
    color: first?.color ?? "lime",
    conditionName: first?.name ?? null,
  };
}

export async function getConditions() {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.catalog);
  return db.condition.findMany({
    select: {
      slug: true,
      name: true,
      color: true,
      icon: true,
      medications: {
        select: { medication: { select: { slug: true } } },
        orderBy: { medication: { scarceInCss: "desc" } },
        take: 1,
      },
    },
    orderBy: { sort: "asc" },
  });
}

export async function getConditionWithMedications(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.catalog);
  const condition = await db.condition.findUnique({
    where: { slug },
    select: {
      name: true,
      color: true,
      icon: true,
      medications: {
        select: { medication: { select: medicationSelect } },
        orderBy: [
          { medication: { scarceInCss: "desc" } },
          { medication: { activeIngredient: "asc" } },
        ],
      },
    },
  });
  if (!condition) return null;
  return { ...condition, medications: condition.medications.map((m) => toSummary(m.medication)) };
}

export async function getMedication(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.catalog);
  const m = await db.medication.findUnique({ where: { slug }, select: medicationSelect });
  return m ? toSummary(m) : null;
}

export async function getAllMedications() {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.catalog);
  const rows = await db.medication.findMany({
    select: medicationSelect,
    orderBy: [{ scarceInCss: "desc" }, { activeIngredient: "asc" }, { strength: "asc" }],
  });
  return rows.map(toSummary);
}

export type SearchHit = Pick<
  MedicationSummary,
  "slug" | "activeIngredient" | "strength" | "form" | "scarceInCss"
> & { conditionName: string | null };

/**
 * Búsqueda difusa: cada palabra debe aparecer o parecerse (pg_trgm word_similarity ≥ 0.35).
 * Tolera errores de tipeo ("metrotexato") y encuentra por marca ("lantus") o condición ("artritis").
 */
export async function searchMedications(query: string, limit = 8): Promise<SearchHit[]> {
  const tokens = normalize(query)
    .split(" ")
    .filter((t) => t.length >= 2)
    .slice(0, 4);
  if (tokens.length === 0) return [];

  const match = Prisma.join(
    tokens.map(
      (t) =>
        Prisma.sql`(m.search_text LIKE ${"%" + t + "%"} OR word_similarity(${t}, m.search_text) >= 0.35)`,
    ),
    " AND ",
  );
  const score = Prisma.join(
    tokens.map(
      (t) =>
        Prisma.sql`(word_similarity(${t}, m.search_text) + CASE WHEN m.search_text LIKE ${t + "%"} THEN 0.5 ELSE 0 END)`,
    ),
    " + ",
  );

  return db.$queryRaw<SearchHit[]>`
    SELECT m.slug, m.active_ingredient AS "activeIngredient", m.strength, m.form,
           m.scarce_in_css AS "scarceInCss",
           (SELECT c.name FROM medication_conditions mc JOIN conditions c ON c.id = mc.condition_id
             WHERE mc.medication_id = m.id ORDER BY c.sort LIMIT 1) AS "conditionName"
    FROM medications m
    WHERE ${match}
    ORDER BY ${score} DESC, m.scarce_in_css DESC, m.active_ingredient
    LIMIT ${limit}`;
}
