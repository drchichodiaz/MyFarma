import { describe, expect, it } from "vitest";
import { sign, verify } from "@/lib/signed";

describe("enlaces firmados", () => {
  const secret = "un-secreto-de-prueba";
  it("verifica su propia firma", () => {
    expect(verify("alerta1", sign("alerta1", secret, "baja"), secret, "baja")).toBe(true);
  });
  it("no sirve para otro valor, otro propósito u otro secreto", () => {
    const t = sign("alerta1", secret, "baja");
    expect(verify("alerta2", t, secret, "baja")).toBe(false);
    expect(verify("alerta1", t, secret, "otra-cosa")).toBe(false);
    expect(verify("alerta1", t, "otro-secreto", "baja")).toBe(false);
    expect(verify("alerta1", "x", secret, "baja")).toBe(false);
  });
});
