import { describe, expect, it } from "vitest";
import {
  computeAvailability,
  type AvailabilityEvent,
  type ConfirmationEvent,
  type ReportEvent,
} from "@/lib/availability-rules";

const t = (min: number) => new Date(Date.UTC(2026, 10, 25, 12, min));
const report = (
  id: string,
  at: number,
  status: ReportEvent["status"],
  extra: Partial<ReportEvent> = {},
): ReportEvent => ({
  kind: "report",
  id,
  userId: `u-${id}`,
  status,
  priceCents: null,
  at: t(at),
  ...extra,
});
const confirm = (
  userId: string,
  at: number,
  reportStatus: ReportEvent["status"],
  agrees: boolean,
): ConfirmationEvent => ({
  kind: "confirmation",
  userId,
  reportStatus,
  agrees,
  at: t(at),
});

describe("computeAvailability", () => {
  it("sin reportes no hay estado", () => {
    expect(computeAvailability([])).toBeNull();
  });

  it("un reporte define el estado, el precio y una confirmación", () => {
    const a = computeAvailability([report("r1", 0, "AVAILABLE", { priceCents: 1520 })]);
    expect(a).toEqual({
      status: "AVAILABLE",
      priceCents: 1520,
      confirmedAt: t(0),
      confirmations: 1,
      lastReportId: "r1",
    });
  });

  it("gana el reporte más nuevo aunque contradiga", () => {
    const a = computeAvailability([report("r1", 0, "AVAILABLE"), report("r2", 10, "OUT")]);
    expect(a?.status).toBe("OUT");
    expect(a?.lastReportId).toBe("r2");
    expect(a?.confirmations).toBe(1);
  });

  it("las confirmaciones que coinciden suman personas y refrescan la hora", () => {
    const events: AvailabilityEvent[] = [
      report("r1", 0, "AVAILABLE"),
      confirm("a", 5, "AVAILABLE", true),
      confirm("b", 9, "AVAILABLE", true),
    ];
    const a = computeAvailability(events);
    expect(a?.status).toBe("AVAILABLE");
    expect(a?.confirmations).toBe(3);
    expect(a?.confirmedAt).toEqual(t(9));
  });

  it('"Ya no había" sobre un Hay cambia el estado a No hay', () => {
    const a = computeAvailability([
      report("r1", 0, "AVAILABLE", { priceCents: 900 }),
      confirm("a", 5, "AVAILABLE", false),
    ]);
    expect(a?.status).toBe("OUT");
    expect(a?.priceCents).toBeNull();
    expect(a?.confirmations).toBe(1);
    expect(a?.lastReportId).toBe("r1");
  });

  it('"Sí había" sobre un No hay cambia el estado a Hay', () => {
    const a = computeAvailability([report("r1", 0, "OUT"), confirm("a", 5, "OUT", false)]);
    expect(a?.status).toBe("AVAILABLE");
  });

  it("la misma persona cuenta una sola vez en la racha", () => {
    const a = computeAvailability([
      report("r1", 0, "AVAILABLE", { userId: "a" }),
      report("r2", 40, "AVAILABLE", { userId: "a" }),
    ]);
    expect(a?.confirmations).toBe(1);
  });

  it("Quedan pocas no suma a la racha de Hay", () => {
    const a = computeAvailability([report("r1", 0, "AVAILABLE"), report("r2", 10, "LOW")]);
    expect(a?.status).toBe("LOW");
    expect(a?.confirmations).toBe(1);
  });

  it("conserva el último precio de un reporte anterior si el nuevo no trae precio", () => {
    const a = computeAvailability([
      report("r1", 0, "AVAILABLE", { priceCents: 1520 }),
      report("r2", 10, "LOW"),
    ]);
    expect(a?.priceCents).toBe(1520);
  });

  it("un precio de hace más de 30 días ya no se muestra", () => {
    const old = new Date(t(0).getTime() - 31 * 24 * 60 * 60 * 1000);
    const a = computeAvailability([
      { ...report("r1", 0, "AVAILABLE", { priceCents: 1520 }), at: old },
      report("r2", 0, "AVAILABLE"),
    ]);
    expect(a?.priceCents).toBeNull();
  });
});
