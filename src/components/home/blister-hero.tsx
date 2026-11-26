import { Icon } from "@/components/ui/icon";

const FILLED = [1, 1, 0, 1, 0, 1, 1, 0, 1, 0];

/** Blíster de metotrexato: las tabletas que faltan representan la escasez. Puro CSS. */
export function BlisterHero() {
  return (
    <div className="relative mx-auto aspect-[4/3.7] w-full max-w-[440px]">
      <div className="absolute inset-[10%] rounded-full bg-white/40 blur-3xl" />
      <div
        className="foil absolute rounded-[1.8rem] border border-line p-5 shadow-lift sm:p-6"
        style={{ inset: "6% 5% 18% 9%", transform: "rotate(-6deg)" }}
      >
        <div className="flex items-center justify-between font-mono text-[10px] tracking-wider text-muted">
          <span>METOTREXATO 2.5 mg</span>
          <span>LOTE 24-118</span>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-3 sm:gap-4">
          {FILLED.map((filled, i) => (
            <div key={i} className={`pocket aspect-square ${filled ? "" : "pocket-empty"}`}>
              {filled ? (
                <span className="tablet" style={{ animationDelay: `${450 + i * 90}ms` }} />
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-4 h-px bg-line" />
        <div className="mt-2 font-mono text-[10px] tracking-wider text-muted">
          VENTA BAJO RECETA MÉDICA
        </div>
      </div>
      <div className="float absolute bottom-0 left-0 w-[80%] rounded-2xl border border-line bg-surface p-4 text-ink shadow-lift sm:-left-2">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ok/15 text-ok">
            <Icon name="pin" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-extrabold">Encuentra quién tiene cerca</div>
            <div className="truncate text-xs text-muted">
              Existencia, precio y cuándo se confirmó
            </div>
          </div>
        </div>
      </div>
      <div className="float-2 absolute top-0 right-0 flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-bg shadow-lift">
        <span className="pulse size-1.5 rounded-full bg-ok text-ok" />
        Reportes de pacientes
      </div>
    </div>
  );
}
