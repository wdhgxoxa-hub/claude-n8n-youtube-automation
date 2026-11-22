"use client";
import { RotateCcw } from "lucide-react";
import { Logo } from "@/marca/Logo";
import "@/componentes/resto-diseno.css";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone estado-diseno">
      <Logo size={48} />
      <span className="resto-eyebrow">Una pausa inesperada</span>
      <h1>No pudimos cargar tu espacio.</h1>
      <p>Vuelve a intentarlo. Tu trabajo guardado sigue aquí.</p>
      <button className="button" onClick={reset}>
        <RotateCcw size={17} />
        Intentar otra vez
      </button>
    </main>
  );
}
