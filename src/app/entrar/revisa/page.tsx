import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Revisa tu correo", robots: { index: false } };

export default function CheckEmailPage() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-5 sm:px-6">
      <section className="rise flex flex-col items-center rounded-[2rem] bg-surface px-6 py-12 text-center shadow-soft">
        <span className="pop grid size-20 place-items-center rounded-full bg-lime text-limeink shadow-lift">
          <Icon name="mail" className="size-9" />
        </span>
        <h1 className="mt-6 font-display text-4xl font-black tracking-[-0.04em]">
          Revisa tu correo
        </h1>
        <p className="mt-3 max-w-sm text-muted">
          Te mandamos un enlace para entrar. Ábrelo en este mismo teléfono o computadora. Vale por
          24 horas.
        </p>
        <p className="mt-2 max-w-sm text-sm text-muted">
          ¿No llega? Mira en <b className="text-ink">Spam</b> o{" "}
          <b className="text-ink">Promociones</b>.
        </p>
        <Link href="/entrar" className="btn-ghost mt-7">
          <Icon name="back" className="size-4" />
          Usar otro correo
        </Link>
      </section>
    </div>
  );
}
