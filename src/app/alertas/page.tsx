import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/ui/icon";
import { env } from "@/lib/env";
import { currentUser } from "@/server/auth";
import { getAlertFormData, getUserAlerts, pushEnabled } from "@/server/services/alerts";
import { AlertForm } from "./alert-form";
import { AlertList } from "./alert-list";

export const metadata: Metadata = { title: "Alertas" };

export default function AlertsPage({ searchParams }: PageProps<"/alertas">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
      <section className="rise relative overflow-hidden rounded-[2rem] bg-sun p-6 text-[#2b2000] sm:p-10">
        <span
          className="tile-ic pointer-events-none absolute -right-6 -bottom-10 opacity-20 sm:right-6 sm:opacity-90"
          aria-hidden="true"
        >
          <Icon name="bell" className="size-48 sm:size-64" />
        </span>
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2b2000] px-3 py-1.5 text-xs font-extrabold text-sun">
            <Icon name="bell" className="size-3.5" />
            Alertas
          </span>
          <h1 className="mt-4 font-display text-[clamp(2.6rem,9vw,6.4rem)] leading-[.9] font-black tracking-[-0.05em]">
            Avísame.
          </h1>
          <p className="mt-4 max-w-md text-[13px] leading-snug font-extrabold tracking-wide uppercase">
            Que el medicamento te encuentre a ti. Te avisamos en cuanto alguien reporte existencia
            cerca de donde vives o trabajas.
          </p>
        </div>
      </section>

      <div className="mt-6">
        <Suspense fallback={<AlertsSkeleton />}>
          <AlertsArea searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function AlertsArea({
  searchParams,
}: {
  searchParams: PageProps<"/alertas">["searchParams"];
}) {
  const [sp, user] = await Promise.all([searchParams, currentUser()]);
  const med = typeof sp.med === "string" ? sp.med : undefined;

  if (!user) {
    const back = `/alertas${med ? `?med=${encodeURIComponent(med)}` : ""}`;
    return (
      <div className="rise flex flex-col items-center rounded-[2rem] bg-surface px-6 py-12 text-center shadow-soft">
        <span className="grid size-16 place-items-center rounded-full bg-sun text-[#2b2000]">
          <Icon name="bell" className="size-7" />
        </span>
        <h2 className="mt-5 font-display text-3xl font-black tracking-tight">
          Entra para crear alertas
        </h2>
        <p className="mt-2 max-w-sm text-muted">
          Necesitamos saber a qué correo o dispositivo avisarte. Nunca compartimos tus datos.
        </p>
        <Link href={`/entrar?next=${encodeURIComponent(back)}`} className="btn-primary mt-6">
          Entrar <Icon name="arrow" className="size-4" />
        </Link>
      </div>
    );
  }

  const [data, alerts] = await Promise.all([getAlertFormData(), getUserAlerts(user.id)]);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
      <AlertForm
        medications={data.medications}
        branches={data.branches}
        available={data.available}
        defaultMedId={data.medications.find((m) => m.slug === med)?.id}
        vapidPublicKey={pushEnabled ? (env.VAPID_PUBLIC_KEY ?? null) : null}
      />
      <AlertList alerts={alerts} />
    </div>
  );
}

function AlertsSkeleton() {
  return (
    <div
      aria-busy="true"
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]"
    >
      <div className="skeleton h-[42rem] rounded-[2rem]" />
      <div className="skeleton h-64 rounded-[2rem]" />
    </div>
  );
}
