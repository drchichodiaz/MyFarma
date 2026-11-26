import type { Metadata } from "next";

/**
 * Página de "no encontrado" que src/proxy.ts devuelve con estado 404
 * (medicamento, sucursal o condición inexistente).
 */
export { default } from "../not-found";

export const metadata: Metadata = { title: "No encontrado", robots: { index: false } };
