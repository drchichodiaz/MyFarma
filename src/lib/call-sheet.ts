/**
 * Carga rápida (/admin/carga): lo que el equipo averigua llamando a una cadena, sucursal por
 * sucursal. Reglas puras para leer el formulario; sin dependencias de Next ni de la DB.
 */
import { parsePrice } from "./price";
import type { Status } from "./status";

/** Prefijo de los campos de estado: `st-<branchId>` = AVAILABLE | LOW | OUT | "" (sin cambio). */
export const CALL_FIELD = "st-";
export const MAX_CALL_ROWS = 80;

const STATUSES = ["AVAILABLE", "LOW", "OUT"] as const satisfies readonly Status[];

export type CallEntry = { branchId: number; status: Status };
export type CallSheetInput = {
  medicationId: number;
  priceCents: number | null;
  entries: CallEntry[];
};

/**
 * Lee pares [campo, valor] del formulario. Ignora las filas "sin cambio" y lo que no reconoce.
 * Devuelve un error legible si falta el medicamento, no hay ninguna fila o hay demasiadas.
 */
export function parseCallSheet(
  fields: Iterable<[string, FormDataEntryValue]>,
): { ok: true; data: CallSheetInput } | { ok: false; error: string } {
  let medicationId = 0;
  let rawPrice = "";
  const byBranch = new Map<number, Status>();
  for (const [key, value] of fields) {
    if (typeof value !== "string") continue;
    if (key === "medicationId") medicationId = Number(value);
    else if (key === "price") rawPrice = value;
    else if (key.startsWith(CALL_FIELD)) {
      const branchId = Number(key.slice(CALL_FIELD.length));
      const status = STATUSES.find((s) => s === value);
      if (Number.isInteger(branchId) && branchId > 0 && status) byBranch.set(branchId, status);
    }
  }
  if (!Number.isInteger(medicationId) || medicationId <= 0) {
    return { ok: false, error: "Elige un medicamento." };
  }
  if (!byBranch.size) return { ok: false, error: "Marca al menos una sucursal." };
  if (byBranch.size > MAX_CALL_ROWS) {
    return { ok: false, error: `Máximo ${MAX_CALL_ROWS} sucursales por carga.` };
  }
  const priceCents = parsePrice(rawPrice);
  if (Number.isNaN(priceCents)) return { ok: false, error: "El precio no es válido (ej.: 15.20)." };
  return {
    ok: true,
    data: {
      medicationId,
      priceCents,
      entries: [...byBranch].map(([branchId, status]) => ({ branchId, status })),
    },
  };
}

/** "3 Hay · 1 Quedan pocas · 24 No hay" */
export function summarizeCall(entries: CallEntry[]) {
  const n = (s: Status) => entries.filter((e) => e.status === s).length;
  return [
    [n("AVAILABLE"), "Hay"],
    [n("LOW"), "Quedan pocas"],
    [n("OUT"), "No hay"],
  ]
    .filter(([count]) => Number(count) > 0)
    .map(([count, label]) => `${count} ${label}`)
    .join(" · ");
}
