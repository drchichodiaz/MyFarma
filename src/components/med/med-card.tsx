import Link from "next/link";
import { money } from "@/lib/format";
import type { MedicationSummary } from "@/server/services/catalog";
import type { ScarceOverview } from "@/server/services/availability";
import { MedBox } from "./med-box";

/** Tarjeta de medicamento ("Escaseando hoy" y listados por condición). */
export function MedCard({
  med,
  overview,
  index = 0,
}: {
  med: MedicationSummary;
  overview?: ScarceOverview;
  index?: number;
}) {
  const available = overview?.available ?? null;
  return (
    <Link
      href={`/m/${med.slug}`}
      className="rise group flex flex-col rounded-2xl bg-surface p-3 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift"
      style={{ "--d": index + 1 } as React.CSSProperties}
    >
      <div className="relative grid place-items-center overflow-hidden rounded-xl bg-surface2 pt-9 pb-6">
        {med.scarceInCss && (
          <span className="absolute top-3 left-0 rounded-r-lg bg-sun px-2.5 py-1 text-[11px] font-extrabold text-[#3b2a00]">
            Escaso en CSS
          </span>
        )}
        <div className="transition duration-500 group-hover:scale-105 group-hover:-rotate-6">
          <MedBox {...med} />
        </div>
      </div>
      <div className="flex flex-1 flex-col px-1 pt-3">
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
          <span className="truncate">{med.conditionName ?? med.form}</span>
          {available != null && overview && (
            <span className={`shrink-0 font-bold ${available ? "text-ok" : "text-bad"}`}>
              {available}/{overview.total} con existencia
            </span>
          )}
        </div>
        <div className="mt-1 leading-snug font-bold">
          {med.activeIngredient} {med.strength}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="rounded-full border-2 border-ink px-3 py-1.5 text-xs font-extrabold transition group-hover:bg-ink group-hover:text-bg">
            Ver dónde hay
          </span>
          {overview && (
            <span className="font-mono text-sm font-semibold tabular-nums">
              {money(overview.minPriceCents)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function MedCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-soft">
      <div className="skeleton h-44 rounded-xl" />
      <div className="skeleton mt-3 h-3 w-2/3" />
      <div className="skeleton mt-2 h-4 w-4/5" />
      <div className="skeleton mt-4 h-8 w-32 rounded-full" />
    </div>
  );
}
