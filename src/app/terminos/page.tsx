import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Condiciones de uso",
  description: "Las reglas para usar MyFarma: qué es, qué no es y cómo reportar.",
};

const UPDATED = "26 de noviembre de 2026";
const CONTACT = "hola@myfarma.net";

/** Condiciones de uso (borrador; se valida junto con la política de privacidad antes del lanzamiento). */
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
      <div className="eyebrow">Condiciones de uso</div>
      <h1 className="font-display text-[clamp(2.4rem,7vw,4rem)] leading-[.95] font-black tracking-[-0.04em]">
        Reglas claras.
      </h1>
      <p className="mt-3 text-muted">Última actualización: {UPDATED}.</p>

      <div className="mt-6 rounded-[1.6rem] bg-sun p-5 text-[#2b2000] sm:p-6">
        <h2 className="font-display text-xl font-extrabold">En corto</h2>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm font-semibold">
          <li>MyFarma informa dónde hay medicamentos; no los vende ni da consejo médico.</li>
          <li>
            Los datos los reportan otros pacientes y pueden cambiar. Si puedes, llama antes de ir.
          </li>
          <li>
            Reporta solo lo que viste. Los reportes falsos se ocultan y la cuenta se puede bloquear.
          </li>
          <li>Los medicamentos con receta se compran con receta.</li>
        </ul>
      </div>

      <article className="mt-8 flex flex-col gap-8 text-[15px] leading-relaxed [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_li]:mt-1 [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
        <section>
          <h2>Qué es MyFarma</h2>
          <p>
            Un buscador comunitario y gratuito: pacientes cuentan en qué farmacia de Panamá
            encontraron un medicamento, a qué precio y cuándo. Al usar el sitio aceptas estas
            condiciones y nuestra{" "}
            <Link href="/privacidad" className="font-bold underline">
              política de privacidad
            </Link>
            .
          </p>
        </section>

        <section>
          <h2>Qué no es</h2>
          <ul>
            <li>
              No es una farmacia ni vende medicamentos. No tenemos relación comercial con las
              farmacias que aparecen; sus nombres se muestran como dato.
            </li>
            <li>
              No es consejo médico. No cambies ni suspendas un tratamiento por lo que veas aquí:
              consulta a tu médico o farmacéutico.
            </li>
            <li>
              No garantiza existencia ni precios. La información viene de otros pacientes, puede
              estar desactualizada o equivocada, y la farmacia tiene la última palabra.
            </li>
          </ul>
        </section>

        <section>
          <h2>Tu cuenta</h2>
          <p>
            Para reportar, confirmar o crear alertas necesitas una cuenta (con Google o con un
            enlace a tu correo). Debes ser mayor de 18 años. Eres responsable de lo que se publique
            desde tu cuenta. Puedes borrarla cuando quieras desde «Tu cuenta».
          </p>
        </section>

        <section>
          <h2>Cómo reportar</h2>
          <ul>
            <li>Reporta solo lo que viste tú, con la concentración exacta y lo antes posible.</li>
            <li>
              Las fotos deben ser del anaquel o del recibo. No subas fotos de recetas, cédulas,
              personas ni datos personales de nadie.
            </li>
            <li>No uses MyFarma para vender, revender, anunciar ni pedir medicamentos.</li>
            <li>No publiques nada falso, ofensivo o que dañe a otras personas.</li>
          </ul>
          <p>
            Al publicar un reporte o una foto nos das permiso para mostrarlos en MyFarma, sin costo
            y mientras el sitio exista, con tu nombre corto (nombre e inicial del apellido).
          </p>
        </section>

        <section>
          <h2>Moderación</h2>
          <p>
            Podemos ocultar reportes o fotos y suspender cuentas que no cumplan estas reglas, sin
            aviso previo cuando haga falta proteger a otros pacientes. Si crees que fue un error,
            escríbenos a{" "}
            <a href={`mailto:${CONTACT}`} className="font-bold underline">
              {CONTACT}
            </a>
            .
          </p>
        </section>

        <section>
          <h2>Alertas</h2>
          <p>
            Las alertas son un servicio de buena fe: hacemos lo posible por avisarte rápido, pero
            pueden llegar tarde o no llegar (por ejemplo, si tu correo las marca como spam o tu
            celular bloquea las notificaciones). Puedes pausarlas o borrarlas cuando quieras.
          </p>
        </section>

        <section>
          <h2>Responsabilidad</h2>
          <p>
            MyFarma se ofrece «tal cual», gratis y sin garantías. En la medida en que la ley lo
            permita, no respondemos por daños derivados de usar la información publicada por otros
            usuarios, de una visita a una farmacia sin el medicamento, ni de interrupciones del
            servicio.
          </p>
        </section>

        <section>
          <h2>Cambios y ley aplicable</h2>
          <p>
            Si cambiamos estas condiciones de forma importante, lo avisaremos en el sitio. Se rigen
            por las leyes de la República de Panamá. Para cualquier duda:{" "}
            <a href={`mailto:${CONTACT}`} className="font-bold underline">
              {CONTACT}
            </a>
            .
          </p>
        </section>
      </article>
    </div>
  );
}
