"use client";
import { useSyncExternalStore } from "react";
import { usePausaMovimiento } from "./movimiento";
function visibility(notify: () => void) {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
}
import { MotionConfig } from "framer-motion";
import { EscenaEstudio } from "./escena-estudio";
export function EntradaMovimiento({ motivo = "montaje" }: { motivo?: string }) {
  const [paused, setPaused] = usePausaMovimiento();
  const hidden = useSyncExternalStore(
    visibility,
    () => document.hidden,
    () => false,
  );
  return (
    <MotionConfig reducedMotion={paused || hidden ? "always" : "user"}>
      <div
        className="login-cinema"
        data-motion={paused || hidden ? "paused" : "playing"}
      >
        <EscenaEstudio motivo={motivo} />
        <button
          className="motion-toggle"
          aria-pressed={paused}
          onClick={() => setPaused(!paused)}
        >
          {paused ? "Activar movimiento" : "Pausar movimiento"}
        </button>
      </div>
    </MotionConfig>
  );
}
