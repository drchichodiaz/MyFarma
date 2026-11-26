"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import "leaflet.markercluster/dist/MarkerCluster.css";
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

/**
 * Sucursales agrupadas cuando están muy juntas (con datos reales serán cientos).
 * El grupo es verde si alguna tiene existencia. leaflet.markercluster usa `L` global,
 * por eso se carga aquí, después de exponerlo.
 */
function ClusteredPins({
  points,
  icons,
  onOpen,
}: {
  points: MapPoint[];
  icons: L.DivIcon[];
  onOpen: (slug: string) => void;
}) {
  const map = useMap();
  useEffect(() => {
    let group: L.MarkerClusterGroup | null = null;
    let cancelled = false;
    (window as unknown as { L: typeof L }).L = L;
    void import("leaflet.markercluster").then(() => {
      if (cancelled) return;
      group = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 44,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: (cluster) => {
          const children = cluster.getAllChildMarkers();
          const any = children.some((m) => (m.options as { available?: boolean }).available);
          return L.divIcon({
            className: "mf-pin",
            html: `<span class="mf-cluster ${any ? "mf-cluster-on" : ""}">${children.length}</span>`,
            iconSize: [0, 0],
          });
        },
      });
      points.forEach((p, i) => {
        const marker = L.marker([p.lat, p.lng], {
          icon: icons[i],
          title: `${p.chainName} ${p.name}`,
          available: p.status === "AVAILABLE" || p.status === "LOW",
        } as L.MarkerOptions);
        marker.on("click", () => onOpen(p.slug));
        group!.addLayer(marker);
      });
      map.addLayer(group);
    });
    return () => {
      cancelled = true;
      if (group) map.removeLayer(group);
    };
  }, [map, points, icons, onOpen]);
  return null;
}

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
  const open = useCallback(
    (slug: string) => router.push(`/m/${medSlug}/${slug}`),
    [router, medSlug],
  );
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
      <ClusteredPins points={points} icons={icons} onOpen={open} />
      <FitBounds points={points} center={center} />
    </MapContainer>
  );
}
