import { describe, expect, it } from "vitest";
import {
  branchShortName,
  compactHours,
  independentNames,
  slugify,
  validateBranchRows,
} from "@/lib/branch-import";
import { directionsUrl } from "@/lib/maps";

const week = (h: string[]) =>
  ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
    .map((d, i) => `${d}: ${h[i]}`)
    .join(" | ");

describe("slugify", () => {
  it("quita acentos, signos y espacios", () => {
    expect(slugify("Farmacias Arrocha | Vía Argentina")).toBe("farmacias-arrocha-via-argentina");
    expect(slugify("  Farmás  Multiplaza!! ")).toBe("farmas-multiplaza");
  });
});

describe("branchShortName", () => {
  const arrocha = /farmacias?\s+arrocha|arrocha/gi;
  it("toma lo que va después del separador", () => {
    expect(branchShortName("Farmacias Arrocha | Obarrio", arrocha, "Bella Vista")).toBe("Obarrio");
    expect(branchShortName("Farmacias Arrocha • Town Center", arrocha, "x")).toBe("Town Center");
  });
  it("sin separador, quita el nombre de la cadena", () => {
    expect(branchShortName("Farmacia Saba Bella Vista", /(farmacias?\s+)?saba/gi, "x")).toBe(
      "Bella Vista",
    );
  });
  it("si no queda nada, usa la zona", () => {
    expect(branchShortName("Farmacias Arrocha", arrocha, "Betania")).toBe("Betania");
  });
});

describe("independentNames", () => {
  it("la cadena es el nombre comercial y la sucursal, la zona", () => {
    expect(independentNames("Farmacia Lourdes", "Betania")).toEqual({
      chain: "Farmacia Lourdes",
      branch: "Betania",
    });
    expect(independentNames("Pacific Pharmacy | Unicentro", "Bella Vista")).toEqual({
      chain: "Pacific Pharmacy",
      branch: "Unicentro",
    });
  });
});

describe("compactHours", () => {
  it("todos los días iguales", () => {
    expect(compactHours(week(Array(7).fill("7:00–21:00")))).toBe("Lun–Dom 7:00–21:00");
  });
  it("24 horas", () => {
    expect(compactHours(week(Array(7).fill("Abierto 24 horas")))).toBe("Abierta 24 horas");
  });
  it("agrupa días seguidos y omite los cerrados", () => {
    const h = [...Array(5).fill("8:00–17:00"), "8:00–12:00", "Cerrado"];
    expect(compactHours(week(h))).toBe("Lun–Vie 8:00–17:00 · Sáb 8:00–12:00");
  });
  it("vacío → null; formato desconocido → tal cual", () => {
    expect(compactHours("")).toBeNull();
    expect(compactHours("Lun a Vie 8 a 5")).toBe("Lun a Vie 8 a 5");
  });
});

describe("validateBranchRows", () => {
  const row = {
    slug: "arrocha-obarrio",
    chain: "arrocha",
    name: "Obarrio",
    address: "Calle 50",
    phone: "+507 360-4341",
    hours: "Lun–Dom 7:00–22:00",
    lat: "8.99",
    lng: "-79.52",
    verified: "true",
    place_id: "ChIJ1234567890abc",
  };
  it("una fila correcta no da errores", () => {
    expect(validateBranchRows([row], ["arrocha"])).toEqual([]);
  });
  it("detecta cadena desconocida, slug y place_id repetidos", () => {
    const errors = validateBranchRows([row, { ...row }], ["otra"]);
    expect(errors.some((e) => e.includes("cadena desconocida"))).toBe(true);
    expect(errors.some((e) => e.includes("slug") && e.includes("repetido"))).toBe(true);
    expect(errors.some((e) => e.includes("place_id repetido"))).toBe(true);
  });
  it("rechaza coordenadas fuera de Panamá y teléfonos mal escritos", () => {
    const errors = validateBranchRows([{ ...row, lat: "19.4", phone: "3604341" }], ["arrocha"]);
    expect(errors.some((e) => e.includes("lat"))).toBe(true);
    expect(errors.some((e) => e.includes("phone"))).toBe(true);
  });
  it("place_id es opcional", () => {
    expect(validateBranchRows([{ ...row, place_id: "" }], ["arrocha"])).toEqual([]);
  });
});

describe("directionsUrl", () => {
  it("usa el place_id cuando lo hay", () => {
    const url = new URL(directionsUrl({ lat: 8.99, lng: -79.52, placeId: "ChIJabc" }));
    expect(url.searchParams.get("query")).toBe("8.99,-79.52");
    expect(url.searchParams.get("query_place_id")).toBe("ChIJabc");
  });
  it("sin place_id, solo el punto", () => {
    const url = new URL(directionsUrl({ lat: 8.99, lng: -79.52, placeId: null }));
    expect(url.searchParams.has("query_place_id")).toBe(false);
  });
});
