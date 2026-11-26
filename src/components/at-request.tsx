import { connection } from "next/server";

/**
 * Difiere su contenido al momento de la petición.
 * Así el build (y la imagen de Docker) no necesitan la base de datos: lo que va dentro se
 * resuelve en tiempo de ejecución, sale del caché ("use cache") y llega por streaming.
 * Siempre va dentro de un <Suspense> con su skeleton.
 */
export async function AtRequest({ children }: { children: React.ReactNode }) {
  await connection();
  return children;
}
