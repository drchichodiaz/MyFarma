"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

const ITEMS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/", label: "Inicio", icon: "home", match: (p) => p === "/" },
  {
    href: "/buscar",
    label: "Buscar",
    icon: "search",
    match: (p) => p.startsWith("/buscar") || p.startsWith("/m/") || p.startsWith("/c/"),
  },
  { href: "/reportar", label: "Reportar", icon: "plus", match: (p) => p.startsWith("/reportar") },
  { href: "/alertas", label: "Alertas", icon: "bell", match: (p) => p.startsWith("/alertas") },
];

/*
 * Cada barra tiene una vista pura (recibe la ruta) y una versión que lee usePathname().
 * La vista sin ruta sirve de fallback del <Suspense>: el HTML estático trae la barra completa
 * y solo el resaltado de la pestaña activa llega después.
 */

function TopNavView({ pathname }: { pathname: string | null }) {
  return (
    <nav
      className="hidden items-center gap-1 rounded-full bg-surface2 p-1 md:flex"
      aria-label="Principal"
    >
      {ITEMS.map((item) => {
        const active = pathname != null && item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              active ? "bg-lime text-limeink shadow-soft" : "text-muted hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function BottomNavView({ pathname }: { pathname: string | null }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 px-4 pb-[max(8px,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden"
      aria-label="Principal"
    >
      <div className="grid grid-cols-4 pt-2">
        {ITEMS.map((item) => {
          const active = pathname != null && item.match(pathname);
          if (item.icon === "plus") {
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 text-[11px] font-bold ${active ? "text-brand" : "text-muted"}`}
              >
                <span className="-mt-5 grid size-12 place-items-center rounded-full bg-lime text-limeink shadow-lift ring-4 ring-bg">
                  <Icon name="plus" className="size-6" />
                </span>
                {item.label}
              </Link>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-1 text-[11px] font-bold transition ${
                active ? "text-brand" : "text-muted"
              }`}
            >
              <Icon name={item.icon} className="size-6" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function TopNavActive() {
  return <TopNavView pathname={usePathname()} />;
}

function BottomNavActive() {
  return <BottomNavView pathname={usePathname()} />;
}

/** Navegación del header (escritorio). */
export function TopNav() {
  return (
    <Suspense fallback={<TopNavView pathname={null} />}>
      <TopNavActive />
    </Suspense>
  );
}

/** Barra inferior (celular). */
export function BottomNav() {
  return (
    <Suspense fallback={<BottomNavView pathname={null} />}>
      <BottomNavActive />
    </Suspense>
  );
}
