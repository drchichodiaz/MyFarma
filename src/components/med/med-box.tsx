import { tile } from "@/lib/status";
import type { MedicationSummary } from "@/server/services/catalog";

type Props = Pick<
  MedicationSummary,
  "activeIngredient" | "strength" | "pack" | "color" | "requiresRx"
>;

/** Caja de medicamento dibujada con CSS (sin imágenes que descargar). */
export function MedBox({ activeIngredient, strength, pack, color, requiresRx }: Props) {
  const bg = tile(color);
  return (
    <div className="relative h-32 w-24" aria-hidden="true">
      <div
        className={`absolute inset-0 translate-x-2.5 -translate-y-2.5 rounded-lg brightness-90 ${bg}`}
      />
      <div className="absolute inset-0 flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-lift">
        <div className={`h-7 ${bg}`} />
        <div className="flex flex-1 flex-col justify-between p-2 text-left">
          <div>
            <div className="text-[11px] leading-tight font-extrabold text-ink">
              {activeIngredient}
            </div>
            <div className="mt-0.5 font-mono text-[9px] text-muted">{strength}</div>
          </div>
          <div className="flex items-end justify-between">
            <span className="font-mono text-[8px] leading-tight text-muted">{pack}</span>
            {requiresRx && <span className="text-[10px] font-black text-bad">Rx</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
