/**
 * Seed de MyFarma: catálogo (condiciones, medicamentos, cadenas, sucursales) desde CSV
 * y, en desarrollo, reportes de ejemplo para ver la app con datos.
 *
 *   pnpm db:seed               → catálogo + reportes de ejemplo
 *   SEED_DEMO=0 pnpm db:seed   → solo catálogo (lo que se usará en producción)
 *
 * Es idempotente: se puede correr varias veces.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, StockStatus } from "../../src/generated/prisma/client";
import { normalize } from "../../src/lib/text";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const dataDir = join(import.meta.dirname, "data");
const readCsv = <T>(file: string): T[] =>
  parse(readFileSync(join(dataDir, file), "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as T[];
const list = (value: string) => (value ? value.split("|").map((v) => v.trim()) : []);
const bool = (value: string) => value.toLowerCase() === "true";

type ConditionRow = { slug: string; name: string; color: string; icon: string; sort: string };
type MedicationRow = {
  slug: string;
  active_ingredient: string;
  strength: string;
  form: string;
  pack: string;
  requires_rx: string;
  scarce_in_css: string;
  conditions: string;
  aliases: string;
};
type ChainRow = { slug: string; name: string; website: string; color: string };
type BranchRow = {
  slug: string;
  chain: string;
  name: string;
  address: string;
  phone: string;
  hours: string;
  lat: string;
  lng: string;
  verified: string;
};

async function seedCatalog() {
  const conditions = readCsv<ConditionRow>("conditions.csv");
  for (const c of conditions) {
    const data = { name: c.name, color: c.color, icon: c.icon, sort: Number(c.sort) };
    await db.condition.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, ...data },
      update: data,
    });
  }
  const conditionIds = new Map(
    (await db.condition.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
  );
  const conditionNames = new Map(conditions.map((c) => [c.slug, c.name]));

  for (const m of readCsv<MedicationRow>("medications.csv")) {
    const conds = list(m.conditions);
    const aliases = list(m.aliases);
    const data = {
      activeIngredient: m.active_ingredient,
      strength: m.strength,
      form: m.form,
      pack: m.pack || null,
      requiresRx: bool(m.requires_rx),
      scarceInCss: bool(m.scarce_in_css),
      aliases,
      searchText: normalize(
        [
          m.active_ingredient,
          m.strength,
          m.form,
          ...aliases,
          ...conds.map((s) => conditionNames.get(s) ?? s),
        ].join(" "),
      ),
    };
    const med = await db.medication.upsert({
      where: { slug: m.slug },
      create: { slug: m.slug, ...data },
      update: data,
    });
    await db.medicationCondition.deleteMany({ where: { medicationId: med.id } });
    await db.medicationCondition.createMany({
      data: conds.map((slug) => {
        const conditionId = conditionIds.get(slug);
        if (!conditionId) throw new Error(`Condición desconocida "${slug}" en ${m.slug}`);
        return { medicationId: med.id, conditionId };
      }),
    });
  }

  for (const c of readCsv<ChainRow>("chains.csv")) {
    const data = { name: c.name, website: c.website || null, color: c.color };
    await db.chain.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, ...data },
      update: data,
    });
  }
  const chainIds = new Map(
    (await db.chain.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
  );

  for (const b of readCsv<BranchRow>("branches.csv")) {
    const chainId = chainIds.get(b.chain);
    if (!chainId) throw new Error(`Cadena desconocida "${b.chain}" en ${b.slug}`);
    const data = {
      chainId,
      name: b.name,
      address: b.address,
      phone: b.phone || null,
      hours: b.hours || null,
      lat: Number(b.lat),
      lng: Number(b.lng),
      verified: bool(b.verified),
    };
    await db.branch.upsert({
      where: { slug: b.slug },
      create: { slug: b.slug, ...data },
      update: data,
    });
  }
}

/** Generador pseudoaleatorio con semilla: los datos de ejemplo salen iguales en cada seed. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_NAMES = [
  "Mariela G.",
  "Rubén A.",
  "Yariela C.",
  "Iván P.",
  "Daysi M.",
  "Ricardo Q.",
  "Itzel R.",
  "Abdiel S.",
];
const BASE_PRICE: Record<string, number> = {
  metotrexato: 15,
  "metotrexato-inyectable": 38,
  "acido-folico": 3.5,
  hidroxicloroquina: 22,
  leflunomida: 31,
  sulfasalazina: 14,
  prednisona: 4,
  metformina: 6,
  insulina: 58,
  glibenclamida: 5,
  losartan: 9,
  amlodipino: 7,
  enalapril: 6,
  levotiroxina: 12,
  warfarina: 10,
};

async function seedDemoReports() {
  const users = [];
  for (const [i, name] of DEMO_NAMES.entries()) {
    const email = `demo${i + 1}@myfarma.local`;
    users.push(
      await db.user.upsert({ where: { email }, create: { email, name }, update: { name } }),
    );
  }

  await db.availability.deleteMany();
  await db.report.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });

  const meds = await db.medication.findMany({
    select: { id: true, slug: true, activeIngredient: true, form: true },
  });
  const branches = await db.branch.findMany({ select: { id: true } });
  const now = Date.now();
  const reports: {
    userId: string;
    medicationId: number;
    branchId: number;
    status: StockStatus;
    priceCents: number | null;
    createdAt: Date;
  }[] = [];

  for (const med of meds) {
    const r = rng(med.id * 97 + 13);
    const key =
      normalize(med.activeIngredient).replace(/\s+/g, "-") +
      (med.form.includes("inyectable") ? "-inyectable" : "");
    const base = BASE_PRICE[key] ?? BASE_PRICE[key.split("-")[0]!] ?? 10;
    for (const branch of branches) {
      const roll = r();
      if (roll > 0.88) continue; // sucursal sin reportes para este medicamento
      const status =
        roll < 0.42 ? StockStatus.AVAILABLE : roll < 0.6 ? StockStatus.LOW : StockStatus.OUT;
      const price = Math.round(base * (0.9 + r() * 0.3) * 100);
      let minutesAgo = Math.round(15 + r() * 2400);
      const count = 1 + Math.floor(r() * 3);
      for (let i = 0; i < count; i++) {
        // El más reciente fija el estado; los anteriores pueden diferir (historial realista).
        const s =
          i === 0
            ? status
            : r() < 0.6
              ? status
              : status === StockStatus.OUT
                ? StockStatus.AVAILABLE
                : StockStatus.OUT;
        reports.push({
          userId: users[Math.floor(r() * users.length)]!.id,
          medicationId: med.id,
          branchId: branch.id,
          status: s,
          priceCents: s === StockStatus.OUT ? null : price,
          createdAt: new Date(now - minutesAgo * 60_000),
        });
        minutesAgo += 240 + Math.round(r() * 1400);
      }
    }
  }
  await db.report.createMany({ data: reports });

  // Disponibilidad actual = último reporte de cada par (sucursal, medicamento).
  await db.$executeRaw`
    INSERT INTO availability (branch_id, medication_id, status, price_cents, confirmed_at, confirmations, last_report_id)
    SELECT DISTINCT ON (branch_id, medication_id)
      branch_id, medication_id, status, price_cents, created_at,
      COUNT(*) OVER (PARTITION BY branch_id, medication_id, status), id
    FROM reports
    WHERE NOT hidden
    ORDER BY branch_id, medication_id, created_at DESC`;

  return reports.length;
}

async function main() {
  await seedCatalog();
  const counts = await Promise.all([
    db.condition.count(),
    db.medication.count(),
    db.chain.count(),
    db.branch.count(),
  ]);
  console.log(
    `Catálogo: ${counts[0]} condiciones, ${counts[1]} medicamentos, ${counts[2]} cadenas, ${counts[3]} sucursales`,
  );
  if (process.env.SEED_DEMO !== "0") {
    const n = await seedDemoReports();
    console.log(`Ejemplo: ${n} reportes y su disponibilidad actual`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
