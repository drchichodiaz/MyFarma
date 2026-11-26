import { getMedication } from "@/server/services/catalog";
import { brandImage, OG_SIZE } from "@/server/og";

export const alt = "¿Dónde hay este medicamento? Farmacias en Panamá en MyFarma";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const med = await getMedication(slug);
  return brandImage({
    eyebrow: med ? `${med.form} · ${med.requiresRx ? "con receta" : "sin receta"}` : "MyFarma",
    title: med
      ? `¿Dónde hay ${med.activeIngredient} ${med.strength}?`
      : "Encuentra tu medicamento.",
    subtitle: "Farmacias en Panamá con existencia, precio y última confirmación.",
  });
}
