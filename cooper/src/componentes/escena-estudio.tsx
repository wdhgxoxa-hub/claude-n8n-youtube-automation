"use client";
import { useId, useRef, useState } from "react";
import { Check } from "lucide-react";

const pasos = [
  {
    titulo: "Una idea, un equipo.",
    texto:
      "Cuéntale a Cooper qué quieres crear. Tu canal guarda la voz y el estilo de cada historia.",
  },
  {
    titulo: "La historia toma forma.",
    texto:
      "Sigue el recorrido de tu video. Cooper te espera para aprobar el guion y la versión final.",
  },
  {
    titulo: "Tu mirada decide.",
    texto:
      "Revisa, pide cambios y elige cuándo publicar. Después, mira los resultados y lo aprendido.",
  },
] as const;
export function BienvenidaAnimada() {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);
  return (
    <>
      <button
        className="text-link welcome-trigger"
        onClick={() => {
          setStep(0);
          dialog.current?.showModal();
        }}
      >
        Conocer el estudio
      </button>
      <dialog ref={dialog} className="welcome-tour" aria-labelledby={titleId}>
        <button
          className="tour-close button secondary"
          onClick={() => dialog.current?.close()}
        >
          Cerrar recorrido
        </button>
        <div className="tour-number" aria-hidden="true" key={step}>
          {String(step + 1).padStart(2, "0")}
        </div>
        <div className="tour-copy" aria-live="polite">
          <p className="muted">
            {step + 1} de {pasos.length}
          </p>
          <h2 id={titleId}>{pasos[step].titulo}</h2>
          <p>{pasos[step].texto}</p>
        </div>
        <div className="tour-progress" aria-hidden="true">
          {pasos.map((_, i) => (
            <i key={i} data-active={i <= step} />
          ))}
        </div>
        <div className="button-row">
          {step > 0 && (
            <button
              className="button secondary"
              onClick={() => setStep(step - 1)}
            >
              Anterior
            </button>
          )}
          <button
            className="button"
            onClick={() =>
              step === 2 ? dialog.current?.close() : setStep(step + 1)
            }
          >
            {step === 2 ? "Empezar a crear" : "Continuar"}
          </button>
        </div>
      </dialog>
    </>
  );
}

export function CelebracionPublicacion({
  title,
  cerrar,
}: {
  title: string;
  cerrar: () => void;
}) {
  return (
    <aside
      className="publication-celebration"
      aria-label="Publicación confirmada"
    >
      <span className="publication-badge" aria-hidden="true">
        <Check size={24} />
      </span>
      <div role="status">
        <strong>Ya está en el mundo.</strong>
        <p>{title}</p>
        <small>Publicación confirmada</small>
      </div>
      <button
        className="icon-button"
        aria-label="Cerrar celebración"
        onClick={cerrar}
      >
        ×
      </button>
    </aside>
  );
}
