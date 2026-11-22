"use client";
import { useSyncExternalStore } from "react";
import { Logo } from "@/marca/Logo";
import { useMovimientoReducido, usePausaMovimiento } from "./movimiento";

function visibility(notify: () => void) {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
}

export function EntradaMovimiento({ motivo = "montaje" }: { motivo?: string }) {
  const [paused] = usePausaMovimiento();
  const reduced = useMovimientoReducido();
  const hidden = useSyncExternalStore(
    visibility,
    () => document.hidden,
    () => false,
  );
  return (
    <div
      className="entrada-marca"
      data-motivo={motivo}
      data-motion={paused || hidden || reduced ? "paused" : "playing"}
      aria-hidden="true"
    >
      <Logo size={56} />
    </div>
  );
}
