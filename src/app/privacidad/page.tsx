import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacidad",
  description: "Qué datos guarda MyFarma, para qué, con quién se comparten y cómo borrarlos.",
};

const UPDATED = "26 de noviembre de 2026";
const CONTACT = "hola@myfarma.net";

/**
 * Política de privacidad (borrador alineado con la Ley 81 de 2019 de Panamá y su reglamento,
 * Decreto Ejecutivo 285 de 2021). Antes del lanzamiento la valida alguien que conozca la ley.
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
      <div className="eyebrow">Privacidad</div>
      <h1 className="font-display text-[clamp(2.4rem,7vw,4rem)] leading-[.95] font-black tracking-[-0.04em]">
        Tus datos, en claro.
      </h1>
      <p className="mt-3 text-muted">Última actualización: {UPDATED}.</p>

      <div className="mt-6 rounded-[1.6rem] bg-lime p-5 text-limeink sm:p-6">
        <h2 className="font-display text-xl font-extrabold">Lo más importante</h2>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm font-semibold">
          <li>Para buscar no necesitas cuenta ni das ningún dato.</li>
          <li>En público solo se ve tu nombre y la inicial de tu apellido. Nunca tu correo.</li>
          <li>Nunca pedimos tu receta, tu cédula ni tu diagnóstico.</li>
          <li>
            Quitamos la ubicación GPS y los demás datos ocultos de las fotos antes de publicarlas.
          </li>
          <li>No vendemos tus datos ni mostramos publicidad.</li>
          <li>Puedes borrar tu cuenta tú mismo, cuando quieras, desde «Tu cuenta».</li>
        </ul>
      </div>

      <article className="mt-8 flex flex-col gap-8 text-[15px] leading-relaxed [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_li]:mt-1 [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
        <section>
          <h2>Quiénes somos</h2>
          <p>
            MyFarma es un buscador comunitario de medicamentos en Panamá. Pacientes reportan en qué
            farmacia encontraron un medicamento, a qué precio y cuándo. MyFarma no vende
            medicamentos ni tiene relación comercial con las farmacias. El responsable del
            tratamiento de tus datos es el equipo de MyFarma; puedes escribirnos a{" "}
            <a href={`mailto:${CONTACT}`} className="font-bold underline">
              {CONTACT}
            </a>
            .
          </p>
        </section>

        <section>
          <h2>Qué datos guardamos</h2>
          <ul>
            <li>
              <b>Tu cuenta:</b> correo, nombre (el que pongas o el de Google) y la fecha en que te
              registraste. Si entras con Google, recibimos solo tu nombre, correo y foto de perfil
              (la foto no la mostramos).
            </li>
            <li>
              <b>Tus reportes y confirmaciones:</b> medicamento, sucursal, si había o no, precio si
              lo pones, la hora y, si la subes, una foto.
            </li>
            <li>
              <b>Tus alertas:</b> medicamento, un punto en el mapa redondeado a unos 100 metros
              (nunca tu dirección exacta), el radio y cómo quieres que te avisemos.
            </li>
            <li>
              <b>Avisos al celular:</b> si los activas, tu navegador nos da una dirección técnica
              para enviarte notificaciones. No incluye tu número de teléfono.
            </li>
            <li>
              <b>Datos técnicos:</b> una cookie de sesión para que no tengas que entrar cada vez, y
              registros del servidor (dirección IP, fecha, página) que se guardan unos días para
              seguridad.
            </li>
          </ul>
          <p>
            Lo que reportas o buscas puede dar a entender que tú o alguien cercano usa un
            medicamento, que es un dato de salud. Por eso lo tratamos como dato sensible: tus
            alertas son privadas y en tus reportes públicos solo aparece tu nombre con la inicial.
          </p>
        </section>

        <section>
          <h2>Para qué los usamos</h2>
          <ul>
            <li>
              Mostrar a otros pacientes dónde hay un medicamento (tus reportes, con tu nombre
              corto).
            </li>
            <li>Avisarte cuando alguien reporte tu medicamento cerca (tus alertas).</li>
            <li>Evitar reportes falsos y abuso: límites de uso y moderación.</li>
            <li>Mantener el sitio funcionando y seguro.</li>
          </ul>
          <p>
            Los usamos con tu consentimiento, que das al crear tu cuenta, y puedes retirarlo en
            cualquier momento borrándola. No tomamos decisiones automáticas sobre ti ni hacemos
            perfiles.
          </p>
        </section>

        <section>
          <h2>Con quién se comparten</h2>
          <p>
            No vendemos ni cedemos tus datos. Para funcionar usamos estos proveedores, que los
            procesan solo por encargo nuestro:
          </p>
          <ul>
            <li>
              <b>DigitalOcean</b> (servidores, Estados Unidos) y <b>Cloudflare</b> (red de entrega,
              protección contra ataques y almacenamiento de fotos y copias de seguridad).
            </li>
            <li>
              <b>Resend</b> (envío de correos: enlaces para entrar y alertas).
            </li>
            <li>
              <b>Google</b>, solo si eliges entrar con Google, y el servicio de notificaciones de tu
              navegador (Google, Apple o Mozilla) si activas los avisos al celular.
            </li>
          </ul>
          <p>
            Algunos de estos proveedores están fuera de Panamá. Al usar MyFarma consientes esa
            transferencia, que hacemos con proveedores que ofrecen medidas de protección
            equivalentes.
          </p>
        </section>

        <section>
          <h2>Cuánto tiempo los guardamos</h2>
          <ul>
            <li>Tu cuenta y tus alertas: hasta que borres tu cuenta.</li>
            <li>
              Tus reportes: se mantienen porque son información útil para otros pacientes. Si borras
              tu cuenta, quedan como «Paciente», sin tu nombre.
            </li>
            <li>Las fotos originales se borran apenas las procesamos (como máximo en un día).</li>
            <li>Las copias de seguridad se borran solas a los 30 días.</li>
          </ul>
        </section>

        <section>
          <h2>Tus derechos</h2>
          <p>
            Según la Ley 81 de 2019 puedes acceder a tus datos, corregirlos, borrarlos, oponerte a
            su uso y pedir una copia (portabilidad). Desde{" "}
            <Link href="/cuenta" className="font-bold underline">
              Tu cuenta
            </Link>{" "}
            puedes cambiar tu nombre, ver tus reportes, pausar o borrar tus alertas y borrar tu
            cuenta. Para lo demás escríbenos a{" "}
            <a href={`mailto:${CONTACT}`} className="font-bold underline">
              {CONTACT}
            </a>
            ; respondemos en un máximo de 10 días hábiles. Si no quedas conforme, puedes acudir a la
            Autoridad Nacional de Transparencia y Acceso a la Información (ANTAI).
          </p>
        </section>

        <section>
          <h2>Seguridad</h2>
          <p>
            Todo viaja cifrado (HTTPS). No usamos contraseñas: entras con un enlace que vence en 24
            horas o con Google. Las copias de seguridad se guardan cifradas fuera del servidor
            principal, y solo el equipo de moderación puede ver los correos de quienes reportan.
          </p>
        </section>

        <section>
          <h2>Menores de edad</h2>
          <p>
            MyFarma está pensado para personas mayores de 18 años. Si un menor necesita un
            medicamento, que su madre, padre o tutor haga la cuenta.
          </p>
        </section>

        <section>
          <h2>Cambios</h2>
          <p>
            Si cambiamos esta política de forma importante, lo avisaremos en el sitio y por correo a
            quienes tengan cuenta antes de que el cambio aplique.
          </p>
        </section>
      </article>
    </div>
  );
}
