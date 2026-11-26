import Link from "next/link";

/** Lo que ve quien no es admin (sin revelar nada del panel). */
export function NoAdmin() {
  return (
    <div className="rounded-[2rem] bg-surface p-8 text-center shadow-soft">
      <h2 className="font-display text-2xl font-black">Solo para moderadores</h2>
      <p className="mt-2 text-sm text-muted">Esta sección necesita una cuenta de administración.</p>
      <Link href="/entrar?next=/admin" className="btn-primary mt-5">
        Entrar
      </Link>
    </div>
  );
}
