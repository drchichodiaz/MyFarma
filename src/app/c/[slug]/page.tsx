import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MedCard, MedCardSkeleton } from "@/components/med/med-card";
import { Icon, isIconName } from "@/components/ui/icon";
import { tile } from "@/lib/status";
import { getConditionWithMedications } from "@/server/services/catalog";

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const c = await getConditionWithMedications((await params).slug);
  return { title: c ? `Medicamentos para ${c.name.toLowerCase()}` : "Condición no encontrada" };
}

export default function ConditionPage({ params }: PageProps<"/c/[slug]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
      <Suspense
        fallback={
          <>
            <div className="skeleton h-56 rounded-[2rem]" />
            <div className="mt-6 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <MedCardSkeleton key={i} />
              ))}
            </div>
          </>
        }
      >
        <Condition params={params} />
      </Suspense>
    </div>
  );
}

async function Condition({ params }: { params: Promise<{ slug: string }> }) {
  const condition = await getConditionWithMedications((await params).slug);
  if (!condition) notFound();
  return (
    <>
      <section
        className={`rise relative overflow-hidden rounded-[2rem] p-6 text-tileink sm:p-10 ${tile(condition.color)}`}
      >
        <span
          className="tile-ic pointer-events-none absolute -right-6 -bottom-10 opacity-90 sm:right-6"
          aria-hidden="true"
        >
          <Icon
            name={isIconName(condition.icon) ? condition.icon : "drop"}
            className="size-48 sm:size-64"
          />
        </span>
        <div className="relative max-w-3xl">
          <span className="inline-flex rounded-full bg-tileink px-3 py-1.5 text-xs font-extrabold text-white">
            {condition.medications.length} medicamentos
          </span>
          <h1 className="mt-4 font-display text-[clamp(2.4rem,8vw,5.6rem)] leading-[.9] font-black tracking-[-0.045em]">
            {condition.name}
          </h1>
        </div>
      </section>
      <div className="mt-6 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
        {condition.medications.map((m, i) => (
          <MedCard key={m.id} med={m} index={i} />
        ))}
      </div>
    </>
  );
}
