import Link from "next/link";
import { Icon, isIconName } from "@/components/ui/icon";
import { tile } from "@/lib/status";
import { getConditions } from "@/server/services/catalog";

/** Cuadros pastel "Busca por condición". */
export async function ConditionGrid() {
  const conditions = await getConditions();
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
      {conditions.map((c, i) => (
        <Link
          key={c.slug}
          href={`/c/${c.slug}`}
          className="rise group text-center"
          style={{ "--d": i + 1 } as React.CSSProperties}
        >
          <span
            className={`relative grid aspect-[4/3.6] place-items-center overflow-hidden rounded-2xl text-tileink transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lift ${tile(c.color)}`}
          >
            <span className="absolute -right-6 -bottom-6 size-20 rounded-full bg-white/30" />
            <span className="tile-ic relative">
              <Icon name={isIconName(c.icon) ? c.icon : "drop"} className="size-14" />
            </span>
          </span>
          <span className="mt-2 block text-sm font-bold">{c.name}</span>
        </Link>
      ))}
    </div>
  );
}

export function ConditionGridSkeleton() {
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[4/3.6]" />
          <div className="skeleton mx-auto mt-2 h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
