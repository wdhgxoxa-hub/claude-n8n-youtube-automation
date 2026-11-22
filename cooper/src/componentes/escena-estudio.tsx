"use client";
import { useId, useRef, useState } from "react";
import { Check } from "lucide-react";
import { m as motion } from "framer-motion";
import { resorte, useMovimientoReducido } from "./movimiento";
import { useTinteVideo } from "./tinte-video";
export type Momento = "publicado" | "terminado" | "aprobado" | "record";

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
  momento = "publicado",
  videoId,
}: {
  title: string;
  cerrar: () => void;
  momento?: Momento;
  videoId?: string;
}) {
  const reduced = useMovimientoReducido();
  const tinte = useTinteVideo(videoId);
  const texto = {
    publicado: ["Publicación confirmada", "Ya está en el mundo."],
    terminado: ["Video terminado", "Listo para tu mirada."],
    aprobado: ["Aprobación confirmada", "Aprobado. Seguimos."],
    record: ["Nuevo récord", "Llegaste más lejos."],
  }[momento];
  return (
    <aside
      className="publication-celebration"
      aria-label={texto[0]}
      style={tinte}
    >
      <motion.span
        className="publication-badge"
        aria-hidden="true"
        initial={reduced ? false : { scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduced ? { duration: 0 } : resorte}
      >
        <Check size={24} />
      </motion.span>
      <div role="status">
        <strong>{texto[1]}</strong>
        <p>{title}</p>
        <small>{texto[0]}</small>
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
