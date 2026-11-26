import type { Status } from "@/lib/status";

/**
 * Reglas de disponibilidad (PLAN.md → Reglas de disponibilidad), sin base de datos.
 *
 * Cada reporte y cada confirmación es una "observación" de lo que alguien vio en la sucursal:
 * - Un reporte observa su propio estado.
 * - Una confirmación que coincide ("Sí había" sobre un Hay) observa el estado del reporte.
 * - Una que lo contradice ("Ya no había" sobre un Hay) observa No hay; y "Sí había" sobre un
 *   No hay observa Hay.
 * Gana la observación más nueva. `confirmations` cuenta cuántas personas distintas vieron ese
 * mismo estado seguido, desde el último cambio.
 */

export type ReportEvent = {
  kind: "report";
  id: string;
  userId: string | null;
  status: Status;
  priceCents: number | null;
  at: Date;
};

export type ConfirmationEvent = {
  kind: "confirmation";
  reportStatus: Status;
  userId: string;
  agrees: boolean;
  at: Date;
};

export type AvailabilityEvent = ReportEvent | ConfirmationEvent;

export type ComputedAvailability = {
  status: Status;
  priceCents: number | null;
  confirmedAt: Date;
  confirmations: number;
  lastReportId: string;
};

/** Precio que sigue valiendo si nadie reporta uno más nuevo. */
export const PRICE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Estado que observa una confirmación. */
export function observedStatus(e: ConfirmationEvent): Status {
  if (e.agrees) return e.reportStatus;
  return e.reportStatus === "OUT" ? "AVAILABLE" : "OUT";
}

export function computeAvailability(events: AvailabilityEvent[]): ComputedAvailability | null {
  const reports = events.filter((e): e is ReportEvent => e.kind === "report");
  if (!reports.length) return null;

  // Más nuevo primero. Si empatan, el reporte va antes que la confirmación.
  const sorted = [...events].sort(
    (a, b) => b.at.getTime() - a.at.getTime() || (a.kind === "report" ? -1 : 1),
  );
  const statusOf = (e: AvailabilityEvent) => (e.kind === "report" ? e.status : observedStatus(e));

  const newest = sorted[0]!;
  const status = statusOf(newest);

  // Racha: observaciones seguidas (de la más nueva hacia atrás) con el mismo estado.
  const people = new Set<string>();
  let anonymous = 0;
  for (const e of sorted) {
    if (statusOf(e) !== status) break;
    if (e.userId) people.add(e.userId);
    else anonymous++;
  }

  const lastReport = reports.reduce((a, b) => (b.at > a.at ? b : a));

  let priceCents: number | null = null;
  if (status !== "OUT") {
    const priced = reports
      .filter((r) => r.priceCents != null && r.status !== "OUT")
      .filter((r) => newest.at.getTime() - r.at.getTime() <= PRICE_MAX_AGE_MS)
      .sort((a, b) => b.at.getTime() - a.at.getTime())[0];
    priceCents = priced?.priceCents ?? null;
  }

  return {
    status,
    priceCents,
    confirmedAt: newest.at,
    confirmations: people.size + anonymous,
    lastReportId: lastReport.id,
  };
}
