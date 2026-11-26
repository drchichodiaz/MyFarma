// Página temporal de la F0: verifica tokens, fuentes y que el render estático funciona.
// La portada real (del prototipo) se construye en la F1.
const swatches = [
  ["bg-lime", "Lima"],
  ["bg-brand", "Bosque"],
  ["bg-ink", "Marino"],
  ["bg-tteal", "Turquesa"],
  ["bg-tyellow", "Amarillo"],
  ["bg-tsalmon", "Salmón"],
  ["bg-tpink", "Rosa"],
  ["bg-tblue", "Azul"],
] as const;

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-lime px-6 pt-8 pb-8 text-limeink sm:px-10 sm:pt-12">
        <span className="inline-flex rounded-full bg-limeink px-3 py-1.5 text-xs font-bold text-lime">
          F0 · Base lista
        </span>
        <h1 className="mt-4 font-display text-[clamp(2.5rem,11.4vw,10.4rem)] leading-[.86] font-black tracking-[-0.055em]">
          Encuéntralo.
        </h1>
        <p className="mt-5 max-w-md text-[13px] leading-snug font-extrabold tracking-wide uppercase">
          Next.js 16, Tailwind 4, Prisma 7 y PostGIS. La portada del prototipo llega en la F1.
        </p>
      </section>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {swatches.map(([cls, name]) => (
          <li key={name} className="rounded-2xl bg-surface p-3 shadow-soft">
            <span className={`block h-16 rounded-xl ${cls}`} />
            <span className="mt-2 block text-sm font-bold">{name}</span>
          </li>
        ))}
      </ul>

      <p className="mt-6 font-mono text-sm text-muted">
        Estado del servidor:{" "}
        <a className="font-semibold text-brand underline" href="/api/health">
          /api/health
        </a>
      </p>
    </main>
  );
}
