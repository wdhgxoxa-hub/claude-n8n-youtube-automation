"use client";
import {
  useContext,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { MotionConfigContext, motion, useMotionValue } from "framer-motion";
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

export const resorte = { type: "spring", stiffness: 360, damping: 32 } as const;

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
                  duration: reduced ? 0 : 0.7,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {Array.from({ length: 10 }, (_, n) => (
                  <span key={n}>{n}</span>
                ))}
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
  const rotateX = useMotionValue(0),
    rotateY = useMotionValue(0);
  return (
    <motion.button
      className="queue-item"
      aria-pressed={selected}
      onClick={onClick}
      initial={false}
      animate={{ opacity: 1 }}
      style={
        {
          rotateX: reduced ? 0 : rotateX,
          rotateY: reduced ? 0 : rotateY,
          transformPerspective: 700,
          "--card": index,
        } as CSSProperties
      }
      onPointerMove={(event) => {
        if (reduced || event.pointerType !== "mouse") return;
        const bounds = event.currentTarget.getBoundingClientRect();
        rotateX.set((0.5 - (event.clientY - bounds.top) / bounds.height) * 5);
        rotateY.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 5);
      }}
      onPointerLeave={() => {
        rotateX.set(0);
        rotateY.set(0);
      }}
      onBlur={() => {
        rotateX.set(0);
        rotateY.set(0);
      }}
      whileTap={reduced ? {} : { scale: 0.98 }}
    >
      {children}
    </motion.button>
  );
}
