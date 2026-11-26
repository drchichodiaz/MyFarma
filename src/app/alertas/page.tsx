import type { Metadata } from "next";
import { ComingSoon } from "@/components/site/coming-soon";

export const metadata: Metadata = { title: "Alertas" };

export default function AlertsPage() {
  return (
    <ComingSoon
      title="Avísame."
      phase="F3"
      text="Pronto podrás recibir un aviso por correo o en el celular cuando alguien reporte tu medicamento cerca."
      icon="bell"
      bg="bg-sun"
    />
  );
}
