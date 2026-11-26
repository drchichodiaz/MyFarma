import { Logo } from "./site-header";

const COLUMNS = [
  [
    "Qué es",
    "Un buscador comunitario de medicamentos escasos en Panamá, hecho por y para pacientes.",
  ],
  [
    "Qué no es",
    "MyFarma no vende medicamentos: informa dónde hay. Los medicamentos con receta se compran con receta.",
  ],
  ["Datos", "Mientras estemos en desarrollo, farmacias, precios y reportes son de ejemplo."],
] as const;

export function SiteFooter() {
  return (
    <footer className="px-4 pt-16 pb-28 sm:px-6 md:pb-8">
      <div className="mx-auto max-w-6xl rounded-[2rem] bg-forest p-3 text-white sm:p-4">
        <div className="grid gap-6 px-3 pt-5 pb-6 text-sm sm:grid-cols-3 sm:px-5">
          {COLUMNS.map(([title, text]) => (
            <div key={title}>
              <div className="text-xs font-extrabold tracking-[.14em] text-lime uppercase">
                {title}
              </div>
              <p className="mt-2 text-white/75">{text}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 overflow-hidden rounded-[1.5rem] bg-lime px-5 py-5 text-limeink sm:gap-5 sm:px-8 sm:py-7">
          <Logo className="size-14 shrink-0 bg-limeink! text-lime! sm:size-20" />
          <span className="font-display text-[clamp(2.6rem,11vw,7.5rem)] leading-none font-black tracking-[-0.05em]">
            MyFarma
          </span>
        </div>
      </div>
    </footer>
  );
}
