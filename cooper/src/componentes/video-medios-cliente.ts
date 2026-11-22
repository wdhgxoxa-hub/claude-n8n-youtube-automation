"use client";

import {
  useCallback,
  useEffect,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import type { VideoMedios } from "@/contratos/video-medios";

const PLAZO_MEDIOS_MS = 300_000;
const ESPERA_INICIAL_MS = 1_500;
const ESPERA_MAXIMA_MS = 15_000;
const LIMITE_SOLICITUD_MS = 15_000;

/**
 * Seguimiento compartido por URL de medios. La caché durable está en el
 * servidor; aquí solo se garantiza una consulta por medio aunque lo muestren
 * varias piezas a la vez (la pared y su enlace, la pista y su cola) o aunque
 * su visibilidad cambie mientras el derivado se prepara.
 */
type Seguimiento = {
  datos?: VideoMedios;
  oyentes: Set<() => void>;
  activos: number;
  vence: number;
  proxima: number;
  intentos: number;
  enCurso: boolean;
  resuelto: boolean;
  timer?: ReturnType<typeof setTimeout>;
};

const seguimientos = new Map<string, Seguimiento>();

function obtener(url: string) {
  let s = seguimientos.get(url);
  if (!s) {
    s = {
      oyentes: new Set(),
      activos: 0,
      vence: Date.now() + PLAZO_MEDIOS_MS,
      proxima: 0,
      intentos: 0,
      enCurso: false,
      resuelto: false,
    };
    seguimientos.set(url, s);
  }
  return s;
}

/** Se retira después del commit: React suelta y vuelve a tomar la suscripción
 * en un mismo commit (remontaje o cambio de visibilidad), y en ese intervalo
 * el seguimiento debe conservar su espera y su último dato. */
function retirarSiLibre(url: string, s: Seguimiento) {
  queueMicrotask(() => {
    if (s.oyentes.size || s.activos) return;
    clearTimeout(s.timer);
    s.timer = undefined;
    if (seguimientos.get(url) === s) seguimientos.delete(url);
  });
}

function suscribir(url: string, avisar: () => void) {
  const s = obtener(url);
  s.oyentes.add(avisar);
  return () => {
    s.oyentes.delete(avisar);
    retirarSiLibre(url, s);
  };
}

function programar(url: string, s: Seguimiento) {
  if (s.enCurso || s.timer || s.resuelto || s.activos === 0) return;
  const ahora = Date.now();
  if (ahora >= s.vence) return;
  s.timer = setTimeout(
    () => {
      s.timer = undefined;
      void leer(url, s);
    },
    Math.max(0, s.proxima - ahora),
  );
}

async function leer(url: string, s: Seguimiento) {
  // Fuera de vista se pausa: la próxima activación respeta la espera vigente.
  if (s.activos === 0 || s.resuelto) return;
  s.enCurso = true;
  try {
    const r = await fetch(url, {
      credentials: "same-origin",
      signal: AbortSignal.timeout(LIMITE_SOLICITUD_MS),
    });
    if (r.ok) {
      s.datos = (await r.json()) as VideoMedios;
      s.resuelto = s.datos.estado !== "pendiente";
      for (const avisar of s.oyentes) avisar();
    } else if (r.status < 500) {
      // Sin permiso o inexistente: repetir no cambia la respuesta.
      s.resuelto = true;
    }
  } catch {
    // Corte o plazo vencido: el póster o la espera siguen visibles y se
    // reintenta con la misma espera creciente que un derivado pendiente.
  } finally {
    s.proxima =
      Date.now() +
      Math.min(ESPERA_INICIAL_MS * 2 ** s.intentos++, ESPERA_MAXIMA_MS);
    s.enCurso = false;
    programar(url, s);
  }
}

export function useVideoMedios({
  videoId,
  inicial,
  publicacion,
  visible = true,
}: {
  videoId: string;
  inicial?: VideoMedios;
  publicacion?: string;
  visible?: boolean;
}) {
  const url = `/api/videos/${encodeURIComponent(videoId)}/medios${publicacion ? `?publicacion=${encodeURIComponent(publicacion)}` : ""}`;
  const estadoInicial = inicial?.estado;
  const actualizadoInicial = inicial?.actualizadoEn ?? 0;
  const activo = visible && Boolean(videoId) && estadoInicial !== "sin_medio";
  // Suscripción estable por URL: React no la suelta en cada render.
  const datos = useSyncExternalStore(
    useCallback((avisar: () => void) => suscribir(url, avisar), [url]),
    () => seguimientos.get(url)?.datos,
    () => undefined,
  );
  useEffect(() => {
    if (!activo) return;
    const s = obtener(url);
    // Una revisión nueva del servidor (SSR/SSE) vuelve a abrir el seguimiento.
    if (
      s.resuelto &&
      estadoInicial === "pendiente" &&
      actualizadoInicial > (s.datos?.actualizadoEn ?? 0)
    ) {
      s.resuelto = false;
      s.intentos = 0;
      s.proxima = 0;
      s.vence = Date.now() + PLAZO_MEDIOS_MS;
    }
    s.activos++;
    programar(url, s);
    return () => {
      s.activos--;
      if (s.activos === 0) {
        clearTimeout(s.timer);
        s.timer = undefined;
      }
      retirarSiLibre(url, s);
    };
  }, [url, activo, estadoInicial, actualizadoInicial]);
  if (!datos) return inicial;
  return inicial && inicial.actualizadoEn > datos.actualizadoEn
    ? inicial
    : datos;
}

export function estiloMedio(
  medio?: VideoMedios,
  proporcion?: number,
): CSSProperties {
  return {
    "--tinte": medio?.tinte,
    "--medio-proporcion": proporcion ?? medio?.relacionAspecto ?? 16 / 9,
  } as CSSProperties;
}
