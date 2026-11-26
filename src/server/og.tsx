import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** Tamaño estándar de las vistas previas (WhatsApp, Facebook, X, Google). */
export const OG_SIZE = { width: 1200, height: 630 };

const asset = (path: string) => readFile(join(process.cwd(), path));

/**
 * Vista previa con la marca: fondo verde bosque, logo, título grande en Archivo.
 * Las fuentes y el logo se leen del disco (assets/fonts y public/brand).
 */
export async function brandImage({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  const [black, medium, logo] = await Promise.all([
    asset("assets/fonts/archivo-900.woff"),
    asset("assets/fonts/archivo-500.woff"),
    asset("public/brand/icon-192.png"),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0a2a12",
        padding: 64,
        fontFamily: "Archivo",
        color: "#ffffff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image */}
        <img src={logoSrc} width={84} height={84} alt="" />
        <span style={{ fontSize: 48, fontWeight: 900, color: "#a0e468", letterSpacing: -1 }}>
          MyFarma
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <span
          style={{
            fontSize: 26,
            fontWeight: 500,
            color: "#a0e468",
            textTransform: "uppercase",
            letterSpacing: 4,
          }}
        >
          {eyebrow}
        </span>
        <span style={{ fontSize: 78, fontWeight: 900, lineHeight: 1, letterSpacing: -2 }}>
          {title}
        </span>
        <span style={{ fontSize: 30, fontWeight: 500, color: "rgba(255,255,255,.78)" }}>
          {subtitle}
        </span>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: "Archivo", data: black, weight: 900, style: "normal" },
        { name: "Archivo", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}
