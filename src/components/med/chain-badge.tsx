import { initials } from "@/lib/format";
import { tile } from "@/lib/status";

/** Distintivo de la cadena: cuadro pastel con sus iniciales (no usamos logos de terceros). */
export function ChainBadge({
  name,
  color,
  className = "size-14 text-base",
}: {
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-2xl font-display font-black text-tileink ${tile(color)} ${className}`}
      aria-hidden="true"
    >
      <span className="absolute -right-3 -bottom-3 size-8 rounded-full bg-white/35" />
      <span className="relative">{initials(name)}</span>
    </span>
  );
}
