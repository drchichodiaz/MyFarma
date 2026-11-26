import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/ui/icon";
import { publicName } from "@/lib/people";
import { currentUser } from "@/server/auth";
import { getReportOptions } from "@/server/services/reports";
import { ReportForm } from "./report-form";

export const metadata: Metadata = { title: "Reportar" };

export default function ReportPage({ searchParams }: PageProps<"/reportar">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
      <section className="rise relative overflow-hidden rounded-[2rem] bg-tsalmon p-6 text-tileink sm:p-10">
        <span
          className="tile-ic pointer-events-none absolute -right-6 -bottom-10 opacity-90 sm:right-6"
          aria-hidden="true"
        >
          <Icon name="chat" className="size-48 sm:size-64" />
        </span>
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tileink px-3 py-1.5 text-xs font-extrabold text-tsalmon">
            <Icon name="plus" className="size-3.5" />
            Reportar
          </span>
          <h1 className="mt-4 font-display text-[clamp(2.6rem,9vw,6.4rem)] leading-[.9] font-black tracking-[-0.05em]">
            Cuéntalo.
          </h1>
          <p className="mt-4 max-w-md text-[13px] leading-snug font-extrabold tracking-wide uppercase">
            ¿Fuiste a una farmacia? Tu reporte toma 20 segundos y le ahorra el recorrido al
            siguiente paciente.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/55 px-3 py-1.5">
              <Icon name="clock" className="size-3.5" />
              20 segundos
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/55 px-3 py-1.5">
              <Icon name="shield" className="size-3.5" />
              Sin datos de tu receta
            </span>
          </div>
        </div>
      </section>

      <div className="mt-6">
        <Suspense fallback={<FormSkeleton />}>
          <ReportArea searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function ReportArea({
  searchParams,
}: {
  searchParams: PageProps<"/reportar">["searchParams"];
}) {
  const [sp, user] = await Promise.all([searchParams, currentUser()]);
  const med = typeof sp.med === "string" ? sp.med : undefined;
  const branch = typeof sp.sucursal === "string" ? sp.sucursal : undefined;

  if (!user) {
    const back = `/reportar${med || branch ? `?${new URLSearchParams({ ...(med && { med }), ...(branch && { sucursal: branch }) })}` : ""}`;
    return (
      <div className="rise flex flex-col items-center rounded-[2rem] bg-surface px-6 py-12 text-center shadow-soft">
        <span className="grid size-16 place-items-center rounded-full bg-lime text-limeink">
          <Icon name="user" className="size-7" />
        </span>
        <h2 className="mt-5 font-display text-3xl font-black tracking-tight">
          Entra para reportar
        </h2>
        <p className="mt-2 max-w-sm text-muted">
          Pedimos una cuenta para evitar reportes falsos. En público solo se ve tu nombre y la
          inicial del apellido.
        </p>
        <Link href={`/entrar?next=${encodeURIComponent(back)}`} className="btn-primary mt-6">
          Entrar <Icon name="arrow" className="size-4" />
        </Link>
      </div>
    );
  }

  const { medications, branches } = await getReportOptions();
  return (
    <ReportForm
      medications={medications}
      branches={branches}
      defaultMedId={medications.find((m) => m.slug === med)?.id}
      defaultBranchId={branches.find((b) => b.slug === branch)?.id}
      who={publicName(user.name) === "Paciente" ? "ti" : publicName(user.name)}
    />
  );
}

function FormSkeleton() {
  return (
    <div
      aria-busy="true"
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]"
    >
      <div className="skeleton h-[34rem] rounded-[2rem]" />
      <div className="skeleton h-64 rounded-[2rem]" />
    </div>
  );
}
