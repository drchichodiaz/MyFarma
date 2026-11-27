import { describe, expect, it } from "vitest";
import { MAX_CALL_ROWS, parseCallSheet, summarizeCall } from "@/lib/call-sheet";
import { CALL_REPORTER, reporterName } from "@/lib/people";

const form = (fields: Record<string, string>) => Object.entries(fields);

describe("parseCallSheet", () => {
  it("lee el medicamento y solo las sucursales marcadas", () => {
    const r = parseCallSheet(
      form({ medicationId: "3", "st-10": "AVAILABLE", "st-11": "OUT", "st-12": "", price: "" }),
    );
    expect(r).toEqual({
      ok: true,
      data: {
        medicationId: 3,
        priceCents: null,
        entries: [
          { branchId: 10, status: "AVAILABLE" },
          { branchId: 11, status: "OUT" },
        ],
      },
    });
  });

  it("ignora estados y sucursales que no reconoce", () => {
    const r = parseCallSheet(
      form({ medicationId: "3", "st-x": "OUT", "st-5": "MAYBE", "st-6": "LOW" }),
    );
    expect(r.ok && r.data.entries).toEqual([{ branchId: 6, status: "LOW" }]);
  });

  it("convierte el precio a centavos", () => {
    const r = parseCallSheet(form({ medicationId: "1", "st-1": "AVAILABLE", price: "B/. 15,20" }));
    expect(r.ok && r.data.priceCents).toBe(1520);
  });

  it("errores legibles", () => {
    expect(parseCallSheet(form({ "st-1": "OUT" }))).toEqual({
      ok: false,
      error: "Elige un medicamento.",
    });
    expect(parseCallSheet(form({ medicationId: "1" }))).toMatchObject({ ok: false });
    expect(
      parseCallSheet(form({ medicationId: "1", "st-1": "OUT", price: "gratis" })),
    ).toMatchObject({
      ok: false,
    });
    const many = Object.fromEntries(
      Array.from({ length: MAX_CALL_ROWS + 1 }, (_, i) => [`st-${i + 1}`, "OUT"]),
    );
    expect(parseCallSheet(form({ medicationId: "1", ...many }))).toMatchObject({ ok: false });
  });
});

describe("summarizeCall", () => {
  it("cuenta por estado y omite los que no hay", () => {
    expect(
      summarizeCall([
        { branchId: 1, status: "OUT" },
        { branchId: 2, status: "AVAILABLE" },
        { branchId: 3, status: "OUT" },
      ]),
    ).toBe("1 Hay · 2 No hay");
  });
});

describe("reporterName", () => {
  it("los reportes por llamada salen a nombre de MyFarma, nunca de quien los cargó", () => {
    expect(reporterName("Adrian Diaz", "CALL")).toBe(CALL_REPORTER);
    expect(reporterName("Adrian Diaz", "USER")).toBe("Adrian D.");
  });
});
