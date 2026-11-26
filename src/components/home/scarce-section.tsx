import { MedCard, MedCardSkeleton } from "@/components/med/med-card";
import { getAllMedications } from "@/server/services/catalog";
import { getScarceOverview } from "@/server/services/availability";

/** "Escaseando hoy": medicamentos escasos con cuántas sucursales tienen y desde qué precio. */
export async function ScarceSection() {
  // En paralelo: catálogo y resumen de disponibilidad no dependen uno del otro.
  const [meds, overview] = await Promise.all([getAllMedications(), getScarceOverview()]);
  const byId = new Map(overview.map((o) => [o.medicationId, o]));
  const scarce = meds.filter((m) => m.scarceInCss).slice(0, 4);
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
      {scarce.map((m, i) => (
        <MedCard key={m.id} med={m} overview={byId.get(m.id)} index={i} />
      ))}
    </div>
  );
}

export function ScarceSectionSkeleton() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <MedCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Cinta animada con los medicamentos escasos. */
export async function ScarceTicker() {
  const meds = (await getAllMedications()).filter((m) => m.scarceInCss);
  const items = meds.map((m) => (
    <span key={m.id} className="inline-flex items-center gap-3">
      <span className="size-2 rounded-full bg-lime" />
      {m.activeIngredient} {m.strength}
    </span>
  ));
  return (
    <div className="marquee flex w-max gap-10 pl-10 whitespace-nowrap">
      <span className="text-lime/60">ESCASEANDO EN LA CSS</span>
      {items}
      <span className="text-lime/60" aria-hidden="true">
        ESCASEANDO EN LA CSS
      </span>
      <span className="contents" aria-hidden="true">
        {items}
      </span>
    </div>
  );
}
