"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { distribuirFilas, type Medida } from "@/lib/reticula";
import styles from "./publicados.module.css";

// Altura de fila deseada: 320 px en escritorio y 220 px en móvil (tope 1,25×).
const OBJETIVO_ESCRITORIO = 320;
const OBJETIVO_MOVIL = 220;
const useEfectoDeDiseno =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Retícula justificada para medios 9:16 y 16:9 mezclados. Calcula en cliente
 * el tamaño exacto de cada pieza antes del primer pintado: el póster ocupa su
 * caja desde el inicio y nada se mueve al llegar las imágenes.
 */
export function ParedJustificada({
  proporciones,
  etiqueta,
  pieza,
}: {
  proporciones: number[];
  etiqueta: string;
  pieza: (indice: number, medida: Medida) => ReactNode;
}) {
  const raiz = useRef<HTMLElement>(null);
  const [filas, setFilas] = useState<Medida[][] | null>(null);
  const clave = proporciones.join("|");

  useEfectoDeDiseno(() => {
    const el = raiz.current;
    if (!el) return;
    const medir = () => {
      const ancho = el.clientWidth;
      if (!ancho) return;
      const hueco = parseFloat(getComputedStyle(el).columnGap) || 16;
      const movil = window.matchMedia("(max-width: 767px)").matches;
      const siguiente = distribuirFilas(
        clave ? clave.split("|").map(Number) : [],
        ancho,
        {
          objetivo: movil ? OBJETIVO_MOVIL : OBJETIVO_ESCRITORIO,
          hueco,
        },
      );
      setFilas((previo) =>
        previo && JSON.stringify(previo) === JSON.stringify(siguiente)
          ? previo
          : siguiente,
      );
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [clave]);

  let indice = 0;
  return (
    <section
      ref={raiz}
      className={styles.pared}
      data-medida={filas ? "lista" : "pendiente"}
      aria-label={etiqueta}
    >
      {filas ? (
        filas.map((fila, f) => (
          <div className={styles.fila} key={f}>
            {fila.map((medida) => {
              const actual = indice++;
              return pieza(actual, medida);
            })}
          </div>
        ))
      ) : (
        // Antes de medir, las piezas existen pero no se pintan: sin saltos.
        <div className={styles.fila}>
          {proporciones.map((p, i) =>
            pieza(i, {
              ancho: Math.round(p * OBJETIVO_ESCRITORIO),
              alto: OBJETIVO_ESCRITORIO,
            }),
          )}
        </div>
      )}
    </section>
  );
}
