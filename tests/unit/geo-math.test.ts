import { describe, expect, it } from "vitest";
import { distanceKm, radarPosition } from "@/lib/geo-math";

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
