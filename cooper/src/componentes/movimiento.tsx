"use client";
import {
  useContext,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { MotionConfigContext, m as motion } from "framer-motion";
const motionQuery = "(prefers-reduced-motion: reduce)";
function observarPreferencia(notify: () => void) {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}
export function useMovimientoReducido() {
  // Framer Motion 12 conserva la preferencia del montaje. Esta suscripción
  // también detiene los MotionValues al cambiar la preferencia en vivo.
  const reduced = useSyncExternalStore(
    observarPreferencia,
    () => window.matchMedia(motionQuery).matches,
    () => true,
  );
  const config = useContext(MotionConfigContext);
  return reduced || config.reducedMotion === "always";
}

export const resorte = { type: "spring", stiffness: 380, damping: 34 } as const;

// Rodillos de tamaño fijo: solo transform, sin setState por fotograma ni cambios de ancho.
export function NumeroAnimado({
  value,
  money = false,
}: {
  value: number;
  money?: boolean;
}) {
  const reduced = useMovimientoReducido();
  const label = new Intl.NumberFormat(
    "es-PE",
    money ? { style: "currency", currency: "USD" } : {},
  ).format(value);
  return (
    <span className="animated-number">
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="number-reels">
        {Array.from(label).map((digit, i) =>
          /\d/.test(digit) ? (
            <span className="number-window" key={i}>
              <motion.span
                className="number-reel"
                initial={reduced ? false : { y: "0%" }}
                animate={{ y: `${-Number(digit) * 10}%` }}
                transition={{
                  duration: reduced ? 0 : 0.64,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {"0\n1\n2\n3\n4\n5\n6\n7\n8\n9"}
              </motion.span>
            </span>
          ) : (
            <span key={i}>{digit}</span>
          ),
        )}
      </span>
    </span>
  );
}

export function Indicador({
  id,
  className = "selection-indicator",
}: {
  id: string;
  className?: string;
}) {
  const reduced = useMovimientoReducido();
  return (
    <motion.span
      aria-hidden="true"
      className={className}
      layoutId={reduced ? undefined : id}
      transition={reduced ? { duration: 0 } : resorte}
    />
  );
}

export function TarjetaEdicion({
  children,
  selected,
  onClick,
  index,
}: {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
  index: number;
}) {
  const reduced = useMovimientoReducido();
  return (
    <motion.button
      className="queue-item"
      aria-pressed={selected}
      onClick={onClick}
      initial={false}
      animate={{ opacity: 1 }}
      style={{ "--orden": Math.min(index, 7) } as CSSProperties}
      whileHover={reduced ? {} : { y: -2 }}
      whileTap={reduced ? {} : { scale: 0.98 }}
    >
      {children}
    </motion.button>
  );
}

function observarPausa(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener("cooper-motion", notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener("cooper-motion", notify);
  };
}
function pausaGuardada() {
  try {
    return localStorage.getItem("cooper-motion-paused") === "true";
  } catch {
    return false;
  }
}

export function usePausaMovimiento() {
  const paused = useSyncExternalStore(
    observarPausa,
    pausaGuardada,
    () => false,
  );
  const [volatilePause, setVolatilePause] = useState(false);
  const isPaused = paused || volatilePause;
  const setPaused = (value: boolean) => {
    try {
      localStorage.setItem("cooper-motion-paused", String(value));
      window.dispatchEvent(new Event("cooper-motion"));
      setVolatilePause(false);
    } catch {
      setVolatilePause(value);
    }
  };
  return [isPaused, setPaused] as const;
}

/** Entrada escalonada, una vez por montaje de la pantalla; tiempos en tokens.css. */
export function Entrada({
  children,
  orden = 0,
}: {
  children: ReactNode;
  orden?: number;
}) {
  return (
    <div
      className="entrada-estudio"
      style={{ "--orden": Math.min(Math.max(orden, 0), 7) } as CSSProperties}
    >
      {children}
    </div>
  );
}
