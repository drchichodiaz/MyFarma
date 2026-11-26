import type { Metadata } from "next";

/** Destino del 404 que decide src/proxy.ts (medicamento, sucursal o condición inexistente). */
export { default } from "../not-found";

export const metadata: Metadata = { title: "No encontrado", robots: { index: false } };
