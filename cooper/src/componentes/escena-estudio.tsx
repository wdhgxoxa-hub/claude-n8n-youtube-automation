"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { IlustracionViva } from "./ilustracion-viva";

const motivos: Record<string, string> = {
  radar: "radar",
  rutina: "calendario",
  programados: "calendario",
  redes: "red",
  cuentas: "red",
  avisos: "senal",
  decisiones: "revision",
  incidencias: "revision",
  referencias: "archivo",
  canales: "archivo",
  videos: "montaje",
  publicados: "grafico",
  aprendizaje: "grafico",
  avatares: "voz",
  perfil: "perfil",
  admin: "control",
};
/** Una sola composición por cabecera; cada ruta tiene un gesto de su oficio. */
export function EscenaEstudio({ motivo }: { motivo?: string }) {
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      el.dataset.visible = String(entry.isIntersecting);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const path = usePathname() ?? "/";
  const kind = motivo ?? motivos[path.split("/")[1]] ?? "montaje";
  return (
    <div
      ref={target}
      className={`studio-scene scene-${kind}`}
      aria-hidden="true"
      data-scene={kind}
    >
      <div className="scene-parallax">
        <div className="scene-halo" />
        <div className="scene-orbit">
          <i />
          <i />
          <i />
        </div>
        <div className="scene-plate plate-back" />
        <div className="scene-plate plate-middle" />
        <div className="scene-plate plate-front">
          <div className="scene-grid" />
          <div className="scene-traces">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <i key={i} style={{ "--i": i } as CSSProperties} />
            ))}
          </div>
          <span className="scene-aperture">
            <i />
          </span>
          <span className="scene-scan" />
        </div>
        <span className="scene-cursor" />
        <div className="scene-track">
          <i />
        </div>
      </div>
    </div>
  );
}

const pasos = [
  {
    titulo: "Una idea, un equipo.",
    texto:
      "Cuéntale a Cooper qué quieres crear. Tu canal guarda la voz y el estilo de cada historia.",
    escena: "cooper-recibe",
  },
  {
    titulo: "La historia toma forma.",
    texto:
      "Sigue el recorrido de tu video. Cooper te espera para aprobar el guion y la versión final.",
    escena: "fabrica",
  },
  {
    titulo: "Tu mirada decide.",
    texto:
      "Revisa, pide cambios y elige cuándo publicar. Después, mira los resultados y lo aprendido.",
    escena: "cooper-celebra",
  },
] as const;
export function BienvenidaAnimada() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="text-link welcome-trigger"
        onClick={() => {
          setStep(0);
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        Conocer el estudio
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        className="welcome-tour"
        aria-labelledby="tour-title"
      >
        <button
          className="tour-close button secondary"
          onClick={() => dialog.current?.close()}
        >
          Cerrar recorrido
        </button>
        {open && (
          <div className="tour-scene" key={step}>
            <IlustracionViva nombre={pasos[step].escena} repetir={step !== 2} />
          </div>
        )}
        <div className="tour-copy" aria-live="polite">
          <p className="muted">
            {step + 1} de {pasos.length}
          </p>
          <h2 id="tour-title">{pasos[step].titulo}</h2>
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
      <IlustracionViva nombre="cooper-celebra" repetir={false} />
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
