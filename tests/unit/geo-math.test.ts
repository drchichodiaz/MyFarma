import { describe, expect, it } from "vitest";
import { distanceKm, radarPosition } from "@/lib/geo-math";
import { formatLocationCookie, parseLocation, parseLocationCookie } from "@/lib/geo";

const viaEspana = { lat: 8.9897, lng: -79.5287 };

describe("distanceKm", () => {
  it("un punto consigo mismo está a 0 km", () => {
    expect(distanceKm(viaEspana, viaEspana)).toBe(0);
  });
  it("0.01° de latitud son ~1.1 km", () => {
    expect(distanceKm(viaEspana, { ...viaEspana, lat: viaEspana.lat + 0.01 })).toBeCloseTo(1.11, 1);
  });
});

describe("radarPosition", () => {
  it("el centro queda en el medio y el norte arriba", () => {
    expect(radarPosition(viaEspana, viaEspana, 10)).toEqual({ left: 50, top: 50 });
    const north = radarPosition(viaEspana, { ...viaEspana, lat: viaEspana.lat + 0.045 }, 10);
    expect(north.left).toBeCloseTo(50);
    expect(north.top).toBeLessThan(30); // ~5 km al norte → a medio camino del borde
    const east = radarPosition(viaEspana, { ...viaEspana, lng: viaEspana.lng + 0.045 }, 10);
    expect(east.left).toBeGreaterThan(70);
  });
});

describe("ubicación (URL, cookie y Vía España)", () => {
  it("la URL manda sobre la cookie", () => {
    const here = parseLocation({ lat: "9.0101", lng: "-79.4999" }, "8.991,-79.521");
    expect(here).toMatchObject({ lat: 9.01, lng: -79.5, isDefault: false });
  });
  it("sin lat/lng en la URL usa la cookie", () => {
    expect(parseLocation({}, "8.991%2C-79.521")).toMatchObject({
      lat: 8.991,
      lng: -79.521,
      label: "tu ubicación",
      isDefault: false,
    });
  });
  it("sin nada válido, Vía España", () => {
    expect(parseLocation({ lat: "", lng: "" }, "basura")).toMatchObject({ isDefault: true });
    expect(parseLocation({}, "40.4,-3.7")).toMatchObject({ isDefault: true }); // fuera de Panamá
    expect(parseLocation({})).toMatchObject({ label: "Vía España", isDefault: true });
  });
  it("la cookie se escribe redondeada a ~100 m y se lee igual", () => {
    const value = formatLocationCookie({ lat: 8.99123, lng: -79.52187 });
    expect(value).toBe("8.991,-79.522");
    expect(parseLocationCookie(value)).toEqual({ lat: 8.991, lng: -79.522 });
  });
});
