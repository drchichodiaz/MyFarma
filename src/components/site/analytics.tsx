import Script from "next/script";

/** Se fija al construir la imagen (variable UMAMI_WEBSITE_ID del repo). Sin ella, nada se carga. */
const WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

/**
 * Umami Cloud: visitas y eventos sin cookies ni datos personales.
 * - data-domains: solo cuenta en myfarma.net (nunca en desarrollo ni en el CI).
 * - data-exclude-search: no envía lo que va después del "?" (ahí puede ir la ubicación).
 * - data-do-not-track: respeta la opción "No rastrear" del navegador.
 */
export function Analytics() {
  if (!WEBSITE_ID) return null;
  return (
    <Script
      src="https://cloud.umami.is/script.js"
      data-website-id={WEBSITE_ID}
      data-domains="myfarma.net"
      data-exclude-search="true"
      data-do-not-track="true"
      strategy="afterInteractive"
    />
  );
}
