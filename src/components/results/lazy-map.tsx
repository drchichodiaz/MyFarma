"use client";

import dynamic from "next/dynamic";

/**
 * Leaflet solo existe en el navegador y pesa ~40 KB: se carga aparte, únicamente en Resultados.
 * Mientras llega, se muestra un esqueleto del mismo tamaño (sin saltos de layout).
 */
export const LazyMap = dynamic(() => import("./results-map"), {
  ssr: false,
  loading: () => <div className="skeleton size-full rounded-none" />,
});
