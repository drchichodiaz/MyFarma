import Link from "next/link";
import { Suspense } from "react";
import { AtRequest } from "@/components/at-request";
import { BlisterHero } from "@/components/home/blister-hero";
import { RecentReports, RecentReportsSkeleton } from "@/components/home/recent-reports";
import {
  ScarceSection,
  ScarceSectionSkeleton,
  ScarceTicker,
} from "@/components/home/scarce-section";
import { ConditionGrid, ConditionGridSkeleton } from "@/components/med/condition-grid";
import { SearchBox } from "@/components/search/search-box";
import { Icon, type IconName } from "@/components/ui/icon";

const STEPS: [string, string, string, string, IconName][] = [
  ["bg-tsalmon", "1", "Busca", "Escribe el principio activo y la concentración.", "search"],
  ["bg-tteal", "2", "Ve quién tiene", "Existencia, precio y hace cuánto lo confirmaron.", "pin"],
  ["bg-tyellow", "3", "Reporta", "Cuenta lo que viste y ayuda al siguiente paciente.", "chat"],
];

/**
 * Portada. El esqueleto (hero, títulos, pasos) es estático; lo que viene de la base de datos
 * llega por streaming dentro de <Suspense>, cacheado en el servidor.
 */
export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="rise relative mt-5 overflow-hidden rounded-[2rem] bg-lime px-5 pt-7 pb-6 text-limeink sm:px-10 sm:pt-10 lg:pb-9">
        <div
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full border-[40px] border-white/25"
          aria-hidden="true"
        />
        <div className="relative flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="inline-flex items-center gap-2 rounded-full bg-limeink px-3 py-1.5 text-lime">
            <span className="pulse size-2 rounded-full bg-lime text-lime" />
            Reportes de pacientes en tiempo real
          </span>
          <span className="rounded-full bg-white/50 px-3 py-1.5">
            Hecho por y para pacientes de la CSS
          </span>
        </div>
        <h1 className="relative mt-4 font-display text-[clamp(2.5rem,11.4vw,10.4rem)] leading-[.86] font-black tracking-[-0.055em]">
          Encuéntralo.
        </h1>
        <div className="relative mt-6 grid items-end gap-8 lg:mt-0 lg:grid-cols-[1fr_minmax(0,380px)_1fr]">
          <div className="order-2 min-w-0 lg:order-1">
            <p className="max-w-xs text-[13px] leading-snug font-extrabold tracking-wide uppercase">
              Deja de recorrer farmacia por farmacia. Pacientes reportan dónde hay tu medicamento, a
              qué precio y cuándo lo confirmaron.
            </p>
            <div className="mt-5 flex flex-wrap gap-5 text-xs font-bold">
              <span className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-full border-2 border-limeink/80">
                  <Icon name="users" className="size-4" />
                </span>
                Reportes de
                <br />
                pacientes
              </span>
              <span className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-full border-2 border-limeink/80">
                  <Icon name="map" className="size-4" />
                </span>
                Sucursales
                <br />
                en el mapa
              </span>
            </div>
          </div>
          <div className="order-1 min-w-0 lg:order-2 lg:-mt-24">
            <BlisterHero />
          </div>
          <div className="order-3 min-w-0">
            <div className="w-full rounded-2xl bg-surface p-3 text-ink shadow-lift sm:max-w-[300px] lg:ml-auto">
              <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-dashed border-line p-4">
                <div className="font-display text-lg leading-tight font-extrabold">
                  ¿Fuiste a una
                  <br />
                  farmacia hoy?
                </div>
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-lime/40 text-brand">
                  <Icon name="camera" className="size-6" />
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="grid size-11 shrink-0 place-items-center rounded-full border border-line text-brand">
                  <Icon name="plus" />
                </span>
                <Link href="/reportar" className="btn-primary flex-1 justify-center">
                  Reporta lo que viste
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="relative mt-8">
          <SearchBox />
        </div>
      </section>

      <div
        className="rise mt-4 overflow-hidden rounded-full bg-limeink py-2.5 text-sm font-extrabold text-lime"
        style={{ "--d": 1 } as React.CSSProperties}
        aria-label="Medicamentos escasos en la CSS"
      >
        <Suspense fallback={<div className="h-5" />}>
          <AtRequest>
            <ScarceTicker />
          </AtRequest>
        </Suspense>
      </div>

      <section className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="h-section">
            Busca por
            <br />
            condición
          </h2>
          <Link
            href="/buscar"
            className="inline-flex items-center gap-1 text-xs font-extrabold tracking-[.12em] uppercase transition-all hover:gap-2"
          >
            Ver todos <Icon name="arrow" className="size-4" />
          </Link>
        </div>
        <Suspense fallback={<ConditionGridSkeleton />}>
          <AtRequest>
            <ConditionGrid />
          </AtRequest>
        </Suspense>
      </section>

      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="h-section">
            Escaseando hoy,
            <br />
            esto es lo que hay
          </h2>
          <Link
            href="/buscar"
            className="inline-flex items-center gap-1 text-xs font-extrabold tracking-[.12em] uppercase transition-all hover:gap-2"
          >
            Todos los medicamentos <Icon name="arrow" className="size-4" />
          </Link>
        </div>
        <Suspense fallback={<ScarceSectionSkeleton />}>
          <AtRequest>
            <ScarceSection />
          </AtRequest>
        </Suspense>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-3">
        {STEPS.map(([bg, n, title, text, icon]) => (
          <div
            key={n}
            className={`group relative min-h-[190px] overflow-hidden rounded-2xl p-6 text-tileink ${bg}`}
          >
            <div className="text-xs font-extrabold tracking-[.14em] uppercase opacity-70">
              Paso {n}
            </div>
            <div className="mt-1 max-w-[12rem] font-display text-3xl leading-none font-extrabold tracking-tight">
              {title}
            </div>
            <p className="mt-3 max-w-[14rem] text-sm font-medium opacity-80">{text}</p>
            <span className="tile-ic absolute -right-3 -bottom-4 opacity-90">
              <Icon name={icon} className="size-28" />
            </span>
          </div>
        ))}
      </section>

      <section className="mt-16 grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
        <div className="min-w-0">
          <div className="eyebrow flex items-center gap-2">
            <span className="pulse size-1.5 rounded-full bg-ok text-ok" />
            En vivo
          </div>
          <h2 className="h-section mt-1">Reportes recientes</h2>
          <Suspense fallback={<RecentReportsSkeleton />}>
            <AtRequest>
              <RecentReports />
            </AtRequest>
          </Suspense>
        </div>
        <Link
          href="/alertas"
          className="group relative self-start overflow-hidden rounded-2xl bg-sun p-6 text-[#2b2000] transition hover:-translate-y-1 hover:shadow-lift"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2b2000] px-3 py-1 text-[11px] font-extrabold text-sun">
            <Icon name="bell" className="size-3.5" />
            Alertas
          </span>
          <div className="mt-3 max-w-[15rem] font-display text-3xl leading-[1.02] font-extrabold tracking-tight">
            Te avisamos cuando haya cerca
          </div>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#2b2000] px-4 py-2 text-xs font-extrabold text-sun transition-all group-hover:gap-3">
            Activar alerta <Icon name="arrow" className="size-4" />
          </span>
          <span className="tile-ic absolute right-[-1rem] bottom-0 text-[#2b2000]/85">
            <Icon name="bell" className="size-32" />
          </span>
        </Link>
      </section>
    </div>
  );
}
