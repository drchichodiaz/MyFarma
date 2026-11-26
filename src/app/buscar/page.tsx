import type { Metadata } from "next";
import { Suspense } from "react";
import { AtRequest } from "@/components/at-request";
import { MedCard, MedCardSkeleton } from "@/components/med/med-card";
import { SearchBox } from "@/components/search/search-box";
import { getAllMedications } from "@/server/services/catalog";

export const metadata: Metadata = { title: "Buscar medicamento" };

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
      <section className="rise rounded-[2rem] bg-lime p-6 text-limeink sm:p-10">
        <h1 className="font-display text-[clamp(2.4rem,8vw,5.6rem)] leading-[.9] font-black tracking-[-0.045em]">
          ¿Qué buscas?
        </h1>
        <p className="mt-3 max-w-md text-[13px] leading-snug font-extrabold tracking-wide uppercase">
          Escribe el principio activo, la marca o la condición. Entendemos errores de tipeo.
        </p>
        <div className="mt-6">
          <SearchBox autoFocus />
        </div>
      </section>
      <h2 className="h-section mt-12">Todos los medicamentos</h2>
      <Suspense
        fallback={
          <div className="mt-6 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <MedCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <AtRequest>
          <AllMedications />
        </AtRequest>
      </Suspense>
    </div>
  );
}

async function AllMedications() {
  const meds = await getAllMedications();
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
      {meds.map((m, i) => (
        <MedCard key={m.id} med={m} index={Math.min(i, 8)} />
      ))}
    </div>
  );
}
