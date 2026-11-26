import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";

/** Pantallas que llegan en fases siguientes (ver PLAN.md). */
export function ComingSoon({
  title,
  phase,
  text,
  icon,
  bg,
}: {
  title: string;
  phase: string;
  text: string;
  icon: IconName;
  bg: string;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
      <section
        className={`rise relative overflow-hidden rounded-[2rem] p-6 text-tileink sm:p-10 ${bg}`}
      >
        <span
          className="tile-ic pointer-events-none absolute -right-6 -bottom-10 opacity-90 sm:right-6"
          aria-hidden="true"
        >
          <Icon name={icon} className="size-48 sm:size-64" />
        </span>
        <div className="relative max-w-2xl">
          <span className="inline-flex rounded-full bg-tileink px-3 py-1.5 text-xs font-extrabold text-white">
            Llega en la {phase}
          </span>
          <h1 className="mt-4 font-display text-[clamp(2.6rem,9vw,6.4rem)] leading-[.9] font-black tracking-[-0.05em]">
            {title}
          </h1>
          <p className="mt-4 max-w-md text-[13px] leading-snug font-extrabold tracking-wide uppercase">
            {text}
          </p>
          <Link href="/buscar" className="btn-primary mt-6">
            Mientras tanto, busca un medicamento <Icon name="arrow" className="size-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
