"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import type { Status } from "@/lib/status";

export type MapPoint = {
  slug: string;
  name: string;
  chainName: string;
  lat: number;
  lng: number;
  status: Status | null;
  label: string;
};

function pinIcon(p: MapPoint) {
  const kind = p.status ?? "NONE";
  return L.divIcon({
    className: "mf-pin",
    html: `<span class="mf-pin-body mf-pin-${kind}">${p.label}</span>`,
    iconSize: [0, 0],
  });
}

const meIcon = L.divIcon({
  className: "mf-pin",
  html: '<span class="mf-me pulse"></span>',
  iconSize: [18, 18],
});

/** Ajusta el encuadre para que se vean todas las sucursales y el usuario. */
function FitBounds({ points, center }: { points: MapPoint[]; center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([
      center,
      ...points.map((p) => [p.lat, p.lng] as [number, number]),
    ]);
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [map, points, center]);
  return null;
}

export default function ResultsMap({
  points,
  center,
  medSlug,
}: {
  points: MapPoint[];
  center: [number, number];
  medSlug: string;
}) {
  const router = useRouter();
  const icons = useMemo(() => points.map(pinIcon), [points]);
  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom={false}
      zoomControl={false}
      className="size-full"
      attributionControl
    >
      {/* Teselas de OpenStreetMap para el MVP. En producción: mapa de Panamá en PMTiles desde R2 (PLAN.md). */}
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      <ZoomControl position="bottomright" />
      <Marker position={center} icon={meIcon} keyboard={false}>
        <Tooltip direction="top" offset={[0, -12]}>
          Tú
        </Tooltip>
      </Marker>
      {points.map((p, i) => (
        <Marker
          key={p.slug}
          position={[p.lat, p.lng]}
          icon={icons[i]}
          title={`${p.chainName} ${p.name}`}
          eventHandlers={{ click: () => router.push(`/m/${medSlug}/${p.slug}`) }}
        />
      ))}
      <FitBounds points={points} center={center} />
    </MapContainer>
  );
}
