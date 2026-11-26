import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
      <section className="rounded-[2rem] bg-surface p-8 shadow-soft sm:p-12">
        <h1 className="font-display text-5xl font-black tracking-tight">No lo encontramos.</h1>
        <p className="mt-3 text-muted">
          La página o el medicamento que buscas no existe o cambió de dirección.
        </p>
        <Link href="/buscar" className="btn-primary mt-6">
          Buscar un medicamento
        </Link>
      </section>
    </div>
  );
}
