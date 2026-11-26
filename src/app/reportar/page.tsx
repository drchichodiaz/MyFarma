import type { Metadata } from "next";
import { ComingSoon } from "@/components/site/coming-soon";

export const metadata: Metadata = { title: "Reportar" };

export default function ReportPage() {
  return (
    <ComingSoon
      title="Cuéntalo."
      phase="F2"
      text="Pronto podrás reportar en qué farmacia encontraste tu medicamento, a qué precio y con foto."
      icon="chat"
      bg="bg-tsalmon"
    />
  );
}
