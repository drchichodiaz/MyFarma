import { describe, expect, it } from "vitest";
import { searchTerm, track } from "@/lib/analytics";

describe("searchTerm", () => {
  it("normaliza: minúsculas, sin acentos ni signos, máximo 40", () => {
    expect(searchTerm("  Metotrexáto  2,5mg!! ")).toBe("metotrexato 2 5mg");
    expect(searchTerm("a".repeat(60))).toHaveLength(40);
  });
});

describe("track", () => {
  it("sin Umami cargado no hace nada ni falla", () => {
    expect(() => track("reporte")).not.toThrow();
  });
});
