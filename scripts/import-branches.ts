/**
 * Importa sucursales reales desde la hoja de trabajo de LeadSeeker (`buscar_farmacias.py`)
 * a `prisma/seed/data/branches.csv` y `chains.csv`. Después, `pnpm db:seed` las carga
 * (y el deploy lo hace solo en producción).
 *
 *   pnpm branches:import <archivo.xlsx>            → solo filas con "Llamada: confirmado" = sí (verified)
 *   pnpm branches:import <archivo.xlsx> --todas    → también las no confirmadas, con verified=false
 *   pnpm branches:import <archivo.xlsx> --dry      → muestra qué haría, sin escribir
 *   pnpm branches:import <archivo.xlsx> --sin-osm  → no consulta OpenStreetMap
 *   pnpm branches:import <archivo.xlsx> --solo-cadenas → solo sucursales de cadenas conocidas
 *
 * De Google solo se guarda el place_id. Las coordenadas se toman de la farmacia más cercana
 * en OpenStreetMap (a menos de 120 m); si no hay, quedan las de la hoja y se avisa para
 * ajustarlas. Teléfono y horario son los de la hoja: se confirman al llamar.
 *
 * Es idempotente: una sucursal ya importada se actualiza (por place_id o slug), no se duplica.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import {
  branchRowSchema,
  branchShortName,
  chainRowSchema,
  compactHours,
  independentNames,
  slugify,
  validateBranchRows,
  type BranchRow,
  type ChainRow,
} from "../src/lib/branch-import";
import { distanceKm } from "../src/lib/geo-math";

const DATA = join(import.meta.dirname, "..", "prisma", "seed", "data");
const CACHE = join(import.meta.dirname, "..", ".cache");
const OSM_MAX_METERS = 120;

/** Cadenas conocidas: slug de la hoja → nombre, patrón para quitarlo del nombre y color. */
const KNOWN: Record<string, { name: string; words: RegExp; website?: string }> = {
  arrocha: { name: "Farmacias Arrocha", words: /farmacias?\s+arrocha|arrocha/gi },
  "metro-plus": { name: "Metro Plus", words: /(farmacias?\s+)?metro\s*plus/gi },
  revilla: { name: "Farmacias Revilla", words: /farmacias?\s+revilla/gi },
  "el-javillo": { name: "Farmacia El Javillo", words: /(farmacias?\s+)?el\s+javillo/gi },
  saba: { name: "Farmacia Saba", words: /(farmacias?\s+)?saba/gi },
  farmavalue: { name: "FarmaValue", words: /farma\s*value/gi },
  farmas: { name: "Farmás", words: /farm[aá]s/gi },
  "xtra-farma": { name: "Xtra Farma", words: /xtra\s*farma/gi },
  "farma-ahorro": { name: "Farma Ahorro", words: /farma\s*ahorro/gi },
  "super-99": { name: "Farmacia Super 99", words: /(farmacia\s+)?(del\s+)?s[uú]per\s*99/gi },
  rey: { name: "Farmacia Rey", words: /(farmacia\s+)?(supermercados?\s+)?rey/gi },
  machetazo: { name: "Farmacia El Machetazo", words: /(farmacia\s+)?el\s+machetazo/gi },
};
const COLORS: ChainRow["color"][] = ["teal", "yellow", "salmon", "pink", "blue", "sun", "lime"];
const colorFor = (slug: string) =>
  COLORS[[...slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length]!;

/** Fichas de Google que no son una farmacia de mostrador. */
const NOT_A_STORE =
  /oficinas?|bodega|centro de distribuci|administraci|veterinari|animal|agropecuari|mascota|\bpet\b|^(al lado|frente|cerca|detr[aá]s)\b/i;

const YES = /^(s[ií]|x|ok|1|true|confirmad[ao])$/i;

type SheetRow = {
  chain: string;
  name: string;
  address: string;
  phone: string;
  hours: string;
  zone: string;
  lat: number;
  lng: number;
  status: string;
  confirmed: boolean;
  placeId: string;
};

async function readSheet(file: string): Promise<SheetRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("El Excel no tiene hojas");
  const header = (ws.getRow(1).values as unknown[]).map((v) => String(v ?? "").trim());
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`Falta la columna "${name}" en el Excel`);
    return i;
  };
  const c = {
    chain: col("Cadena"),
    name: col("Nombre"),
    address: col("Dirección"),
    phone: col("Teléfono"),
    hours: col("Horario"),
    zone: col("Zona"),
    lat: col("lat"),
    lng: col("lng"),
    status: col("Estado"),
    confirmed: col("Llamada: confirmado"),
    placeId: col("place_id"),
  };
  const text = (v: unknown) => {
    if (v && typeof v === "object" && "text" in v) return String((v as { text: unknown }).text);
    return String(v ?? "").trim();
  };
  const rows: SheetRow[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const v = row.values as unknown[];
    rows.push({
      chain: text(v[c.chain]),
      name: text(v[c.name]),
      address: text(v[c.address]),
      phone: text(v[c.phone]),
      hours: text(v[c.hours]),
      zone: text(v[c.zone]),
      lat: Number(v[c.lat]),
      lng: Number(v[c.lng]),
      status: text(v[c.status]),
      confirmed: YES.test(text(v[c.confirmed])),
      placeId: text(v[c.placeId]),
    });
  });
  return rows;
}

/** "XFRH+CJV, Av. Ernestina Sucre Tapia, Panamá, Provincia de Panamá" → "Av. Ernestina Sucre Tapia" */
function cleanAddress(address: string, zone: string) {
  const out = address
    .replace(/\b[23456789CFGHJMPQRVWX]{4}\+[23456789CFGHJMPQRVWX]{2,3}\b,?/g, "")
    .replace(/,?\s*(Panam[aá],?\s*)?Provincia de Panam[aá](\s*Oeste)?\s*$/i, "")
    .replace(/,?\s*Panam[aá]\s*$/i, "")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .replace(/\s+/g, " ");
  return out.length >= 3 ? out.slice(0, 200) : zone;
}

type OsmPoint = { lat: number; lng: number };

/** Farmacias de OpenStreetMap en el recuadro de las filas (se guarda en .cache/ para no repetir). */
async function osmPharmacies(rows: SheetRow[]): Promise<OsmPoint[]> {
  const lats = rows.map((r) => r.lat);
  const lngs = rows.map((r) => r.lng);
  const box = [
    Math.min(...lats) - 0.01,
    Math.min(...lngs) - 0.01,
    Math.max(...lats) + 0.01,
    Math.max(...lngs) + 0.01,
  ].map((n) => n.toFixed(3));
  const cacheFile = join(CACHE, `osm-pharmacies-${box.join("_")}.json`);
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, "utf8")) as OsmPoint[];

  const query = `[out:json][timeout:90];nwr["amenity"="pharmacy"](${box.join(",")});out center;`;
  // Overpass es un servicio de voluntarios y a veces responde 429/502: dos servidores, tres intentos.
  const servers = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3 && !res?.ok; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 5000 * attempt));
    res = await fetch(servers[attempt % servers.length]!, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "myfarma-importer",
      },
      body: new URLSearchParams({ data: query }),
    }).catch(() => null);
  }
  if (!res?.ok) {
    throw new Error(
      `OpenStreetMap (Overpass) no respondió (${res?.status ?? "sin conexión"}); prueba de nuevo o usa --sin-osm`,
    );
  }
  const json = (await res.json()) as {
    elements: { lat?: number; lon?: number; center?: { lat: number; lon: number } }[];
  };
  const points = json.elements
    .map((e) => ({ lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon }))
    .filter((p): p is OsmPoint => typeof p.lat === "number" && typeof p.lng === "number");
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(points));
  return points;
}

function nearest(points: OsmPoint[], p: OsmPoint) {
  let best: OsmPoint | null = null;
  let bestM = Infinity;
  for (const q of points) {
    const m = distanceKm(p, q) * 1000;
    if (m < bestM) [best, bestM] = [q, m];
  }
  return bestM <= OSM_MAX_METERS ? best : null;
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
function writeCsv<T extends Record<string, string>>(file: string, columns: (keyof T)[], rows: T[]) {
  const lines = [
    columns.join(","),
    ...rows.map((r) => columns.map((k) => csvCell(r[k] ?? "")).join(",")),
  ];
  writeFileSync(file, lines.join("\n") + "\n");
}
const readCsv = (file: string) =>
  parse(readFileSync(join(DATA, file), "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error(
      "Uso: pnpm branches:import <archivo.xlsx> [--todas] [--solo-cadenas] [--dry] [--sin-osm]",
    );
    process.exit(1);
  }
  const all = args.includes("--todas");
  const dry = args.includes("--dry");
  const onlyChains = args.includes("--solo-cadenas");

  const sheet = await readSheet(file);
  const skipped = {
    "sin confirmar": 0,
    "no está abierta": 0,
    "mayorista u oficina": 0,
    "sin coordenadas": 0,
    independiente: 0,
  };
  const picked = sheet.filter((r) => {
    if (r.chain === "mayorista?" || NOT_A_STORE.test(r.name))
      return (void skipped["mayorista u oficina"]++, false);
    if (r.status !== "abierta") return (void skipped["no está abierta"]++, false);
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng))
      return (void skipped["sin coordenadas"]++, false);
    if (onlyChains && !KNOWN[r.chain]) return (void skipped["independiente"]++, false);
    if (!r.confirmed && !all) return (void skipped["sin confirmar"]++, false);
    return true;
  });

  const osm = args.includes("--sin-osm") || !picked.length ? [] : await osmPharmacies(picked);

  const chains = new Map<string, ChainRow>(
    readCsv("chains.csv").map((c) => {
      const row = chainRowSchema.parse(c);
      return [row.slug, row];
    }),
  );
  const existing = readCsv("branches.csv").map((b) => branchRowSchema.parse(b));
  const bySlug = new Map(existing.map((b) => [b.slug, b]));
  const byPlace = new Map(existing.filter((b) => b.place_id).map((b) => [b.place_id, b]));

  const stats = {
    nuevas: 0,
    actualizadas: 0,
    "coordenadas de OSM": 0,
    "coordenadas de la hoja": 0,
  };
  const warnings: string[] = [];

  for (const r of picked) {
    // Las filas de búsquedas por cadena no tienen zona: se usa el primer tramo de la dirección.
    const zone = r.zone.startsWith("(")
      ? cleanAddress(r.address, "").split(",")[0]!.trim() || "Ciudad de Panamá"
      : r.zone;

    // Cadena y nombre corto
    let chainSlug: string;
    let branchName: string;
    const known = KNOWN[r.chain];
    if (known) {
      chainSlug = r.chain;
      branchName = branchShortName(r.name, known.words, zone);
      if (!chains.has(chainSlug)) {
        chains.set(chainSlug, {
          slug: chainSlug,
          name: known.name,
          website: known.website ?? "",
          color: colorFor(chainSlug),
        });
      }
    } else {
      const names = independentNames(r.name, zone);
      chainSlug = slugify(names.chain).slice(0, 60);
      branchName = names.branch;
      if (!chains.has(chainSlug)) {
        chains.set(chainSlug, {
          slug: chainSlug,
          name: names.chain.slice(0, 60),
          website: "",
          color: colorFor(chainSlug),
        });
      }
    }

    // Coordenadas: OSM si hay una farmacia a menos de 120 m
    const snap = nearest(osm, r);
    if (snap) stats["coordenadas de OSM"]++;
    else {
      stats["coordenadas de la hoja"]++;
      warnings.push(`sin punto de OSM cerca: ${r.name} (${r.zone})`);
    }
    const point = snap ?? r;

    const phone = /^\+507 \d{3,4}-\d{4}$/.test(r.phone) ? r.phone : "";
    if (r.phone && !phone)
      warnings.push(`teléfono con formato raro, se deja vacío: ${r.name} "${r.phone}"`);
    let hours = compactHours(r.hours) ?? "";
    if (hours.length > 120) hours = hours.slice(0, 117) + "…";

    const prev = (r.placeId && byPlace.get(r.placeId)) || undefined;
    let slug = prev?.slug ?? slugify(`${chainSlug} ${branchName}`).slice(0, 80);
    if (!prev) {
      for (let n = 2; bySlug.has(slug); n++)
        slug = `${slugify(`${chainSlug} ${branchName}`).slice(0, 76)}-${n}`;
    }

    const row: BranchRow = {
      slug,
      chain: chainSlug,
      name: branchName.slice(0, 80),
      address: cleanAddress(r.address, branchName),
      phone,
      hours,
      lat: Math.round(point.lat * 1e6) / 1e6,
      lng: Math.round(point.lng * 1e6) / 1e6,
      // Una sucursal ya verificada no pierde la marca por reimportarla sin confirmar.
      verified: r.confirmed || prev?.verified === "true" ? "true" : "false",
      place_id: r.placeId,
    };
    if (prev) stats.actualizadas++;
    else stats.nuevas++;
    bySlug.set(slug, row);
    if (r.placeId) byPlace.set(r.placeId, row);
  }

  const branchRows = [...bySlug.values()].sort(
    (a, b) => a.chain.localeCompare(b.chain) || a.slug.localeCompare(b.slug),
  );
  const chainRows = [...chains.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  const errors = validateBranchRows(
    branchRows,
    chainRows.map((c) => c.slug),
  );

  console.log(`Hoja: ${sheet.length} filas; se importan ${picked.length}`);
  console.log("Omitidas:", skipped);
  console.log("Resultado:", stats);
  console.log(`Total: ${chainRows.length} cadenas, ${branchRows.length} sucursales en el CSV`);
  if (warnings.length) {
    console.log(`\n${warnings.length} avisos (primeros 15):`);
    for (const w of warnings.slice(0, 15)) console.log("  - " + w);
  }
  if (errors.length) {
    console.error(`\nNo se escribió nada: ${errors.length} errores de validación`);
    for (const e of errors.slice(0, 30)) console.error("  - " + e);
    process.exit(1);
  }
  if (dry) {
    console.log("\nMuestra:");
    for (const b of branchRows.filter((b) => b.place_id).slice(0, 25)) {
      console.log(`  ${b.slug.padEnd(40)} ${chains.get(b.chain)?.name} · ${b.name} · ${b.hours}`);
    }
    console.log("\n--dry: no se escribió nada");
    return;
  }
  writeCsv(join(DATA, "chains.csv"), ["slug", "name", "website", "color"], chainRows);
  writeCsv(
    join(DATA, "branches.csv"),
    ["slug", "chain", "name", "address", "phone", "hours", "lat", "lng", "verified", "place_id"],
    branchRows.map((b) => ({ ...b, lat: String(b.lat), lng: String(b.lng) })),
  );
  console.log("\nListo. Ahora: pnpm db:seed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
