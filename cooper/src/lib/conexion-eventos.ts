// El transporte y la sincronización de datos tienen salud independiente.
// EventSource no distingue HTTP 401 de un corte: HEAD revalida sin pedir datos.
export type EstadoConexion = "iniciando" | "activa" | "interrumpida";
export const TIEMPOS_CONEXION = {
  aviso: 5001,
  apertura: 15000,
  silencio: 45000,
  estable: 15000,
  sesion: 5000,
  reintentoMaximo: 30000,
} as const;

export function conectarEventos<T>({
  recibir,
  cambiar,
}: {
  recibir: (estado: T) => void;
  cambiar: (estado: EstadoConexion, mostrarAviso: boolean) => void;
}) {
  let source: EventSource | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let healthTimer: ReturnType<typeof setTimeout> | undefined;
  let warningTimer: ReturnType<typeof setTimeout> | undefined;
  let probe: AbortController | undefined;
  let attempts = 0;
  let stopped = false;
  let disconnectedAt: number | undefined;
  let healthySince: number | undefined;
  let lastActivity = 0;
  let lastEventId = "";
  let state: EstadoConexion = "iniciando";

  const close = () => {
    source?.close();
    source = undefined;
    clearTimeout(healthTimer);
  };
  const stop = () => {
    stopped = true;
    close();
    clearTimeout(retryTimer);
    clearTimeout(warningTimer);
    probe?.abort();
  };
  const endSession = () => {
    if (stopped) return;
    stop();
    window.location.assign("/entrar");
  };
  const checkSession = async () => {
    if (probe || !navigator.onLine || stopped) return;
    const controller = new AbortController();
    probe = controller;
    const timeout = setTimeout(
      () => controller.abort(),
      TIEMPOS_CONEXION.sesion,
    );
    try {
      const response = await fetch("/api/eventos", {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!stopped && [401, 403].includes(response.status)) endSession();
    } catch {
      // La falta de red no demuestra que la sesión haya caducado.
    } finally {
      clearTimeout(timeout);
      if (probe === controller) probe = undefined;
    }
  };
  const interrupted = () => {
    state = "interrumpida";
    if (disconnectedAt === undefined) {
      disconnectedAt = Date.now();
      warningTimer = setTimeout(() => {
        if (!stopped && disconnectedAt !== undefined) cambiar(state, true);
      }, TIEMPOS_CONEXION.aviso);
    }
    cambiar(state, Date.now() - disconnectedAt >= TIEMPOS_CONEXION.aviso);
  };
  const retry = () => {
    if (stopped) return;
    close();
    interrupted();
    clearTimeout(retryTimer);
    if (!navigator.onLine) return;
    const delay = Math.min(
      1000 * 2 ** attempts,
      TIEMPOS_CONEXION.reintentoMaximo,
    );
    attempts = Math.min(attempts + 1, 5);
    retryTimer = setTimeout(connect, delay);
    void checkSession();
  };
  const healthy = () => {
    if (stopped) return;
    lastActivity = Date.now();
    healthySince ??= lastActivity;
    if (lastActivity - healthySince >= TIEMPOS_CONEXION.estable) attempts = 0;
    state = "activa";
    disconnectedAt = undefined;
    clearTimeout(warningTimer);
    cambiar(state, false);
    clearTimeout(healthTimer);
    healthTimer = setTimeout(retry, TIEMPOS_CONEXION.silencio);
  };
  const connect = () => {
    clearTimeout(retryTimer);
    retryTimer = undefined;
    if (stopped || !navigator.onLine) return;
    close();
    const current = new EventSource(
      lastEventId
        ? `/api/eventos?ultimoEvento=${encodeURIComponent(lastEventId)}`
        : "/api/eventos",
    );
    source = current;
    healthySince = undefined;
    healthTimer = setTimeout(retry, TIEMPOS_CONEXION.apertura);
    const active = () => !stopped && source === current;
    current.onopen = () => {
      if (active()) healthy();
    };
    current.addEventListener("latido", () => {
      if (active()) healthy();
    });
    current.addEventListener("progreso", (event) => {
      if (!active()) return;
      if (event.lastEventId && event.lastEventId.length <= 128)
        lastEventId = event.lastEventId;
      healthy();
    });
    current.addEventListener("estado", (event) => {
      if (!active()) return;
      try {
        recibir(JSON.parse(event.data));
        healthy();
      } catch {
        retry();
      }
    });
    current.addEventListener("sesion-finalizada", () => {
      if (active()) endSession();
    });
    // «fallo» informa de una sincronización fallida, no de un canal caído.
    current.onerror = () => {
      if (active()) retry();
    };
  };
  const offline = () => {
    if (stopped) return;
    clearTimeout(retryTimer);
    retryTimer = undefined;
    close();
    interrupted();
  };
  const online = () => {
    if (!stopped && !source) connect();
  };
  const visible = () => {
    if (document.hidden || stopped) return;
    if (!navigator.onLine) offline();
    else if (!source && !retryTimer) connect();
    else if (
      state === "activa" &&
      Date.now() - lastActivity >= TIEMPOS_CONEXION.silencio
    )
      retry();
  };
  if (navigator.onLine) connect();
  else offline();
  window.addEventListener("offline", offline);
  window.addEventListener("online", online);
  document.addEventListener("visibilitychange", visible);
  return () => {
    stop();
    window.removeEventListener("offline", offline);
    window.removeEventListener("online", online);
    document.removeEventListener("visibilitychange", visible);
  };
}
