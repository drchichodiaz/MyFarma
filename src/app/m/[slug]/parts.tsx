import Link from "next/link";
import { tile } from "@/lib/status";
import type { MedicationSummary } from "@/server/services/catalog";

/** Fila de chips para cambiar de medicamento sin volver a buscar. */
export function MedSwitcher({ meds, current }: { meds: MedicationSummary[]; current: string }) {
  return (
    <nav
      className="-mx-1 flex [scrollbar-width:none] gap-2 overflow-x-auto px-1 pb-2"
      aria-label="Cambiar medicamento"
    >
      {meds.map((m) => {
        const on = m.slug === current;
        return (
          <Link
            key={m.slug}
            href={`/m/${m.slug}`}
            aria-current={on ? "page" : undefined}
            className={`chip shrink-0 ${on ? "chip-on" : ""}`}
          >
            <span className={`size-2.5 rounded-full ring-1 ring-black/10 ${tile(m.color)}`} />
            {m.activeIngredient}{" "}
            <span className="font-mono text-[11px] opacity-70">{m.strength}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Esqueleto de Resultados: mismas proporciones que el contenido real, sin saltos de layout. */
export function ResultsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando resultados">
      <div className="skeleton mt-3 h-[22rem] rounded-[2rem] sm:h-[24rem]" />
      <div className="skeleton mt-6 h-10 w-48" />
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="order-2 flex flex-col gap-3 lg:order-1">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-44 rounded-[1.4rem]" />
          ))}
        </div>
        <div className="skeleton order-1 aspect-[4/3] rounded-[2rem] lg:order-2" />
      </div>
    </div>
  );
}
