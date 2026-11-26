import { brandImage, OG_SIZE } from "@/server/og";

export const alt = "MyFarma: encuentra en qué farmacia de Panamá hay tu medicamento";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return brandImage({
    eyebrow: "Medicamentos escasos en Panamá",
    title: "Encuentra tu medicamento.",
    subtitle: "Dónde hay, a qué precio y cuándo lo confirmó otro paciente.",
  });
}
