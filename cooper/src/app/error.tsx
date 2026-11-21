"use client";
import { EntradaMovimiento } from "@/componentes/entrada-movimiento";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="standalone">
      <EntradaMovimiento motivo="revision" />
      <h1>No pudimos cargar tu espacio.</h1>
      <p>Vuelve a intentarlo. Tu trabajo guardado sigue aquí.</p>
      <button className="button" onClick={reset}>
        Intentar otra vez
      </button>
    </div>
  );
}
