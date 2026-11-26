import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/ui/icon";
import { safeNext } from "@/lib/redirect";
import { hasGoogle } from "@/server/auth";
import { signInWithGoogle } from "./actions";
import { EmailForm } from "./email-form";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

const ERRORS: Record<string, string> = {
  Verification: "Ese enlace ya se usó o venció. Pide uno nuevo abajo.",
  OAuthAccountNotLinked:
    "Ese correo ya entró de otra forma. Usa el mismo método de la primera vez.",
  AccessDenied: "No se pudo entrar con esa cuenta.",
  Configuration: "Hubo un problema de nuestro lado. Intenta de nuevo en unos minutos.",
};

export default function SignInPage({ searchParams }: PageProps<"/entrar">) {
  return (
    <div className="mx-auto grid max-w-5xl items-start gap-6 px-4 pt-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <section className="rise relative overflow-hidden rounded-[2rem] bg-tteal p-6 text-tileink sm:p-10">
        <span
          className="tile-ic pointer-events-none absolute -right-6 -bottom-10 hidden opacity-90 sm:right-6 sm:block"
          aria-hidden="true"
        >
          <Icon name="user" className="size-48 sm:size-56" />
        </span>
        <div className="relative max-w-md">
          <span className="inline-flex rounded-full bg-tileink px-3 py-1.5 text-xs font-extrabold text-tteal">
            Tu cuenta
          </span>
          <h1 className="mt-4 font-display text-[clamp(2.6rem,9vw,5.4rem)] leading-[.9] font-black tracking-[-0.05em]">
            Entra y ayuda.
          </h1>
          <p className="mt-4 text-[13px] leading-snug font-extrabold tracking-wide uppercase">
            Buscar no necesita cuenta. Para reportar y confirmar, sí: así evitamos reportes falsos.
          </p>
          <ul className="mt-5 flex flex-col gap-2 text-sm font-semibold">
            {[
              "En público solo se ve tu nombre y la inicial del apellido.",
              "Nunca mostramos tu correo.",
              "No pedimos datos de tu receta ni tu cédula.",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-tileink text-tteal">
                  <Icon name="check" className="size-3" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div
        className="rise rounded-[2rem] bg-surface p-5 shadow-soft sm:p-8"
        style={{ "--d": 1 } as React.CSSProperties}
      >
        <Suspense fallback={<FormsSkeleton />}>
          <SignInForms searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function SignInForms({
  searchParams,
}: {
  searchParams: PageProps<"/entrar">["searchParams"];
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const error = typeof sp.error === "string" ? (ERRORS[sp.error] ?? ERRORS.Configuration) : null;

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="flex items-start gap-2 rounded-2xl bg-bad/10 p-3 text-sm font-semibold text-bad">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      {hasGoogle && (
        <>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <button type="submit" className="btn-primary w-full justify-center py-4 text-base">
              <GoogleMark />
              Entrar con Google
            </button>
          </form>
          <div className="flex items-center gap-3 text-xs font-bold text-muted">
            <span className="h-px flex-1 bg-line" />o<span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}
      <EmailForm next={next} />
      <p className="text-xs text-muted">
        Al entrar aceptas las{" "}
        <Link href="/terminos" className="font-bold underline">
          condiciones de uso
        </Link>{" "}
        y la{" "}
        <Link href="/privacidad" className="font-bold underline">
          política de privacidad
        </Link>
        .
      </p>
    </div>
  );
}

function FormsSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <div className="skeleton h-14 rounded-full" />
      <div className="skeleton h-4 w-24" />
      <div className="skeleton h-14" />
      <div className="skeleton h-12 rounded-full" />
    </div>
  );
}

function GoogleMark() {
  return (
    <span className="grid size-6 place-items-center rounded-full bg-white">
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"
        />
        <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8z" />
        <path
          fill="#EA4335"
          d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"
        />
      </svg>
    </span>
  );
}
