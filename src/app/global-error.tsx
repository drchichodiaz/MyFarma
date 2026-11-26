"use client";

/**
 * Último recurso: falló el layout raíz. Reemplaza todo el documento, así que no hay estilos
 * de la app; va con estilos en línea y los colores de la marca.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#f0f3f6",
          color: "#161e42",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <main style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 32, margin: 0 }}>MyFarma no cargó</h1>
          <p style={{ color: "#626a84" }}>
            Tuvimos un problema. Intenta de nuevo en un momento. Si sigue, escríbenos a
            hola@myfarma.net.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              background: "#0e4f20",
              color: "#fff",
              border: 0,
              borderRadius: 999,
              padding: "12px 22px",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
