"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Activity, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import type {
  EstadoSalud,
  FuenteSalud,
  UmbralesSalud,
} from "@/contratos/salud-operativa";
import type {
  ConfiguracionSalud as Configuracion,
  PanelSalud as RespuestaSalud,
} from "@/contratos/alertas-salud";
import { ETAPAS } from "@/lib/etapas";
import { api, Heading, Notice } from "./espacio";
import { Cifra, Esqueleto } from "./primitivas";
import "./operacion-diseno.css";

const etiquetasEstado: Record<EstadoSalud, string> = {
  ok: "Operativo",
  degradado: "Requiere atención",
  desconocido: "Sin datos suficientes",
  sin_configurar: "Sin configurar",
  error: "Consulta fallida",
  simulada: "Simulación",
};
const etiquetasVideo = {
  en_curso: "En producción",
  colgado: "Sin avance",
  aprobacion: "Espera aprobación",
  programado: "Programado",
  pausado: "Pausado",
  cancelado: "Cancelado",
  publicado: "Publicado",
  desconocido: "Estado desconocido",
};
const etiquetasEjecucion = {
  correcta: "Correcta",
  fallida: "Fallida",
  ejecutando: "En ejecución",
  esperando: "En espera",
  cancelada: "Cancelada",
  desconocida: "Estado desconocido",
};
const campos: {
  clave: keyof UmbralesSalud;
  etiqueta: string;
  ayuda: string;
  min: number;
  max: number;
  step?: number;
}[] = [
  {
    clave: "discoLibrePorcentaje",
    etiqueta: "Disco libre mínimo (%)",
    ayuda: "Avisar cuando el espacio libre baje de este porcentaje.",
    min: 1,
    max: 50,
    step: 0.1,
  },
  {
    clave: "memoriaUsadaPorcentaje",
    etiqueta: "Memoria usada máxima (%)",
    ayuda: "Avisar cuando el consumo de memoria alcance este porcentaje.",
    min: 10,
    max: 100,
    step: 0.1,
  },
  {
    clave: "certificadoDias",
    etiqueta: "Vencimiento de certificados (días)",
    ayuda: "Avisar con esta anticipación al vencimiento de HTTPS.",
    min: 1,
    max: 90,
  },
  {
    clave: "copiaLocalHoras",
    etiqueta: "Antigüedad máxima de copia local (horas)",
    ayuda: "Avisar cuando no haya una copia local reciente.",
    min: 1,
    max: 720,
  },
  {
    clave: "copiaRemotaHoras",
    etiqueta: "Antigüedad máxima de copia remota (horas)",
    ayuda: "Avisar cuando no haya una copia remota reciente.",
    min: 1,
    max: 720,
  },
  {
    clave: "videoSinAvanceMinutos",
    etiqueta: "Video sin avance (minutos)",
    ayuda:
      "Las aprobaciones, pausas y programaciones se muestran por separado.",
    min: 5,
    max: 10080,
  },
  {
    clave: "fallosN8n",
    etiqueta: "Fallos recientes de n8n",
    ayuda:
      "Número de fallos dentro de la ventana consultada que activa el aviso.",
    min: 1,
    max: 500,
  },
  {
    clave: "gastoDiarioUsd",
    etiqueta: "Gasto diario de aviso (USD)",
    ayuda: "Día de calendario en Lima. Este aviso no bloquea la producción.",
    min: 0.01,
    max: 100000,
    step: 0.01,
  },
  {
    clave: "datosVpsMinutos",
    etiqueta: "Antigüedad máxima de datos del VPS (minutos)",
    ayuda: "Avisar si deja de llegar información reciente del servidor.",
    min: 1,
    max: 1440,
  },
];

function fecha(value: string | null) {
  if (!value) return "Sin registro";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}
function numero(value: number | null, suffix = "") {
  return value === null
    ? "Sin datos"
    : `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}
function bytes(value: number) {
  return `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(value / 1024 ** 3)} GiB`;
}
function money(value: number | null) {
  return value === null
    ? "Sin datos"
    : new Intl.NumberFormat("es-PE", {
        style: "currency",
        currency: "USD",
      }).format(value);
}
function Estado({ value }: { value: EstadoSalud }) {
  return (
    <span className={"salud-badge"} data-state={value}>
      {value === "degradado" || value === "error" ? (
        <TriangleAlert size={15} aria-hidden="true" />
      ) : (
        <Activity size={15} aria-hidden="true" />
      )}
      {etiquetasEstado[value]}
    </span>
  );
}
function CabeceraFuente({
  title,
  source,
  id,
}: {
  title: string;
  source: FuenteSalud;
  id: string;
}) {
  return (
    <>
      <div className={"salud-sectionHead"}>
        <h2 id={id}>{title}</h2>
        <Estado value={source.estado} />
      </div>
      <p className={"salud-muted"}>{source.detalle}</p>
      <p className={"salud-muted"}>
        Datos de la fuente: {fecha(source.actualizado)} (Lima).
      </p>
    </>
  );
}
function Metrica({
  label,
  children,
  detail,
}: {
  label: string;
  children: ReactNode;
  detail?: string;
}) {
  return (
    <div className={"salud-metric"}>
      <dt>{label}</dt>
      <dd>
        {children}
        {detail && <small>{detail}</small>}
      </dd>
    </div>
  );
}

export function SaludOperativa() {
  const [data, setData] = useState<RespuestaSalud | null>(null);
  const [draft, setDraft] = useState<Configuracion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [message, setMessage] = useState("");
  const [review, setReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const fetching = useRef(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const controles = useRef<HTMLDetailsElement>(null);
  const refresh = useCallback(async (force = false) => {
    if (fetching.current && !force) return;
    fetching.current = true;
    const current = generation.current;
    try {
      const value = await api<RespuestaSalud>("admin/salud", undefined, "GET");
      if (!mounted.current || current !== generation.current) return;
      setData(value);
      setDraft((previous) => previous ?? value.configuracion);
      setError("");
    } catch (cause) {
      if (mounted.current && current === generation.current)
        setError((cause as Error).message);
    } finally {
      if (current === generation.current) {
        fetching.current = false;
        if (mounted.current) setLoading(false);
      }
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    queueMicrotask(() => {
      if (mounted.current) void refresh();
    });
    const interval = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 60000);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [refresh]);

  function cambiar(next: Configuracion) {
    setDraft(next);
    setReview(false);
    setConfirmed(false);
    setMessage("");
  }
  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !confirmed) return;
    setSaving(true);
    setSaveError("");
    generation.current++;
    try {
      const value = await api<{ configuracion: Configuracion }>("admin/salud", {
        ...draft,
        confirmado: true,
      });
      setDraft(value.configuracion);
      setData((previous) =>
        previous
          ? { ...previous, configuracion: value.configuracion }
          : previous,
      );
      setReview(false);
      setConfirmed(false);
      setMessage("Configuración de alertas guardada.");
      void refresh(true);
    } catch (cause) {
      setSaveError((cause as Error).message);
      setConfirmed(false);
      void refresh(true);
    } finally {
      setSaving(false);
    }
  }
  const salud = data?.salud;
  const conflict =
    draft && data && draft.revision !== data.configuracion.revision;
  return (
    <div className="page salud-diseno">
      <Heading
        title="Salud de la operación"
        description="Una mirada a la producción y a lo que la mantiene en marcha."
        action={
          <span className="admin-badge">
            <ShieldCheck size={16} />
            Administrador
          </span>
        }
      />
      <div className={"salud-panel"}>
        {salud && (
          <section
            className="salud-pulso"
            aria-label="La operación, de un vistazo"
          >
            <div>
              <span className="operacion-kicker">Ahora en el estudio</span>
              <h2>
                {salud.alertas.length
                  ? "Hay cosas por revisar"
                  : "Todo a la vista"}
              </h2>
              <p>
                {salud.alertas.length
                  ? "Empieza por las alertas y sigue cada caso hasta su origen."
                  : "Revisa las fuentes antes de dar la operación por comprobada."}
              </p>
            </div>
            <div className="operacion-cifras">
              <Cifra
                valor={salud.fabrica.enCurso}
                etiqueta="En producción"
                heroe
              />
              <Cifra
                valor={salud.alertas.length}
                etiqueta="Alertas actuales"
                heroe
              />
            </div>
          </section>
        )}
        <nav className={"salud-links"} aria-label="Controles de la operación">
          <Link href="/admin">Equipo y conciliación</Link>
          <Link href="/incidencias" prefetch={false}>
            Resolver incidencias
          </Link>
          <Link href="/decisiones" prefetch={false}>
            Revisar decisiones
          </Link>
          <Link href="/admin/fabrica" prefetch={false}>
            Ajustes de fábrica
          </Link>
        </nav>
        <div className={"salud-toolbar"}>
          <div>
            <p>Última consulta: {fecha(salud?.actualizado ?? null)} (Lima).</p>
            <p>Actualización cada minuto mientras esta pestaña está visible.</p>
          </div>
          <button
            className="button secondary"
            onClick={() => {
              setLoading(true);
              void refresh();
            }}
            disabled={loading}
          >
            <RefreshCw size={16} />
            {loading ? "Consultando…" : "Actualizar salud"}
          </button>
        </div>
        <Notice error={error} />
        {!data && !error && (
          <div className="operacion-carga" aria-busy="true">
            <Esqueleto etiqueta="Consultando la salud de la operación…" />
            <Esqueleto etiqueta="Cargando fuentes de salud…" />
          </div>
        )}
        {salud && (
          <>
            <nav className={"salud-summary"} aria-label="Resumen de salud">
              {(
                [
                  ["n8n", "n8n"],
                  ["vps", "Servidor VPS"],
                  ["fabrica", "Fábrica"],
                ] as const
              ).map(([key, title]) => (
                <a href={`#salud-${key}`} key={key}>
                  <strong>{title}</strong>
                  <Estado value={salud[key].estado} />
                  <p className={"salud-muted"}>{salud[key].detalle}</p>
                </a>
              ))}
            </nav>
            <section
              className={"salud-section"}
              aria-labelledby="salud-alertas"
            >
              <div className={"salud-sectionHead"}>
                <h2 id="salud-alertas">Alertas actuales</h2>
                <a
                  href="#configurar-alertas"
                  className="button secondary small"
                  onClick={() => {
                    if (controles.current) controles.current.open = true;
                  }}
                >
                  Configurar umbrales
                </a>
              </div>
              {salud.alertas.length === 0 ? (
                <p className={"salud-muted"}>
                  No se detectaron alertas en los datos disponibles. Las fuentes
                  sin datos se indican por separado.
                </p>
              ) : (
                <ul className={"salud-list"}>
                  {salud.alertas.map((alerta) => (
                    <li key={alerta.codigo}>
                      <div className={"salud-itemHead"}>
                        <strong>{alerta.titulo}</strong>
                        <span className={"salud-badge"} data-state="alerta">
                          {alerta.severidad === "critica" ? "Crítica" : "Aviso"}{" "}
                          ·{" "}
                          {alerta.fuente === "vps"
                            ? "VPS"
                            : alerta.fuente === "fabrica"
                              ? "Fábrica"
                              : "n8n"}
                        </span>
                      </div>
                      <p>{alerta.detalle}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section
              className={"salud-section"}
              id="salud-n8n"
              aria-labelledby="titulo-n8n"
            >
              <CabeceraFuente
                id="titulo-n8n"
                title="n8n · Ejecuciones y workflows"
                source={salud.n8n}
              />
              <dl className={"salud-metrics"}>
                <Metrica label="Workflows activos">
                  {salud.n8n.workflowsDisponibles
                    ? numero(salud.n8n.workflowsActivos)
                    : "Sin datos"}
                </Metrica>
                <Metrica label="Ejecuciones consultadas">
                  {salud.n8n.ejecucionesDisponibles
                    ? salud.n8n.ejecuciones.length
                    : "Sin datos"}
                </Metrica>
                <Metrica label="Fallos recientes">
                  {salud.n8n.ejecucionesDisponibles
                    ? salud.n8n.fallosRecientes.length
                    : "Sin datos"}
                </Metrica>
              </dl>
              <p className={"salud-muted"}>
                Ventana desde {fecha(salud.n8n.ventanaDesde)} (Lima).
                {salud.n8n.ejecucionesTruncadas &&
                  " Muestra parcial de ejecuciones; puede haber más resultados."}
              </p>
              <h3>Fallos y causas</h3>
              {!salud.n8n.ejecucionesDisponibles ? (
                <p className={"salud-muted"}>
                  No se pudieron consultar las ejecuciones. No es posible
                  determinar si hubo fallos.
                </p>
              ) : salud.n8n.fallosRecientes.length === 0 ? (
                <p className={"salud-muted"}>
                  No hay fallos en la muestra disponible.
                </p>
              ) : (
                <ul className={"salud-list"}>
                  {salud.n8n.fallosRecientes.map((run) => (
                    <li key={run.id}>
                      <strong>{run.workflow}</strong>
                      <p>
                        {run.causa ??
                          "La ejecución no incluyó una causa legible. Revisa las incidencias asociadas."}
                      </p>
                      <small>
                        Ejecución {run.id} · {fecha(run.fin ?? run.inicio)}{" "}
                        (Lima)
                      </small>
                    </li>
                  ))}
                </ul>
              )}
              {salud.n8n.ejecucionesDisponibles && (
                <details>
                  <summary>
                    Ver ejecuciones consultadas ({salud.n8n.ejecuciones.length})
                  </summary>
                  <ul className={"salud-list"}>
                    {salud.n8n.ejecuciones.map((run) => (
                      <li key={run.id}>
                        <div className={"salud-itemHead"}>
                          <strong>{run.workflow}</strong>
                          <span>{etiquetasEjecucion[run.estado]}</span>
                        </div>
                        <small>
                          Ejecución {run.id} · Inicio: {fecha(run.inicio)} ·
                          Fin: {fecha(run.fin)} (Lima)
                        </small>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {salud.n8n.workflowsDisponibles ? (
                <details>
                  <summary>
                    Ver workflows ({salud.n8n.workflows.length})
                  </summary>
                  <ul className={"salud-list"}>
                    {salud.n8n.workflows.map((workflow) => (
                      <li key={workflow.id}>
                        <div className={"salud-itemHead"}>
                          <strong>{workflow.nombre}</strong>
                          <span>{workflow.activo ? "Activo" : "Inactivo"}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <p className={"salud-muted"}>
                  No se pudieron consultar los workflows.
                </p>
              )}
              {salud.n8n.workflowsTruncados && (
                <p className={"salud-muted"}>
                  Lista parcial de workflows; el total activo corresponde a la
                  muestra consultada.
                </p>
              )}
            </section>
            <section
              className={"salud-section"}
              id="salud-vps"
              aria-labelledby="titulo-vps"
            >
              <CabeceraFuente
                id="titulo-vps"
                title="Servidor VPS"
                source={salud.vps}
              />
              {salud.vps.mantenimiento && (
                <p className="notice">
                  Mantenimiento en curso. Interpreta las mediciones teniendo en
                  cuenta esta pausa.
                </p>
              )}
              <dl className={"salud-metrics"}>
                <Metrica
                  label="Disco libre"
                  detail={
                    salud.vps.disco
                      ? `${bytes(salud.vps.disco.libreBytes)} de ${bytes(salud.vps.disco.totalBytes)}`
                      : undefined
                  }
                >
                  {numero(salud.vps.disco?.librePorcentaje ?? null, " %")}
                </Metrica>
                <Metrica
                  label="Memoria usada"
                  detail={
                    salud.vps.memoria
                      ? `${bytes(salud.vps.memoria.disponibleBytes)} disponibles de ${bytes(salud.vps.memoria.totalBytes)}`
                      : undefined
                  }
                >
                  {numero(salud.vps.memoria?.usadaPorcentaje ?? null, " %")}
                </Metrica>
                <Metrica label="Antigüedad de los datos">
                  {numero(salud.vps.antiguedadMinutos, " min")}
                </Metrica>
              </dl>
              <h3>Disponibilidad de servicios</h3>
              <ul className={"salud-list"}>
                {Object.entries(salud.vps.servicios).map(([name, estado]) => (
                  <li key={name}>
                    <div className={"salud-itemHead"}>
                      <strong>
                        {(
                          {
                            cooper: "Cooper",
                            n8n: "n8n",
                            runner: "Ejecutor de tareas",
                            caddy: "Proxy HTTPS",
                          } as Record<string, string>
                        )[name] ?? name}
                      </strong>
                      <span>
                        {estado === "ok"
                          ? "Disponible"
                          : estado === "down"
                            ? "Sin respuesta"
                            : "Sin datos"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <h3>Certificados HTTPS</h3>
              {salud.vps.certificados.length === 0 ? (
                <p className={"salud-muted"}>
                  No hay mediciones de certificados.
                </p>
              ) : (
                <ul className={"salud-list"}>
                  {salud.vps.certificados.map((cert) => (
                    <li key={cert.servicio}>
                      <div className={"salud-itemHead"}>
                        <strong>
                          {cert.servicio === "cooper" ? "Cooper" : "n8n"}
                        </strong>
                        <span>
                          {numero(cert.diasRestantes, " días restantes")}
                        </span>
                      </div>
                      <small>Vencimiento: {fecha(cert.vence)} (Lima)</small>
                    </li>
                  ))}
                </ul>
              )}
              <h3>Copias de seguridad</h3>
              {salud.vps.copias.length === 0 ? (
                <p className={"salud-muted"}>No hay registros de copias.</p>
              ) : (
                <ul className={"salud-list"}>
                  {salud.vps.copias.map((copy) => (
                    <li key={copy.tipo}>
                      <div className={"salud-itemHead"}>
                        <strong>
                          {copy.tipo === "local"
                            ? "Copia local"
                            : "Copia remota"}
                        </strong>
                        <span>
                          {numero(copy.antiguedadHoras, " h de antigüedad")}
                        </span>
                      </div>
                      <small>
                        Última copia completada: {fecha(copy.completada)} (Lima)
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section
              className={"salud-section"}
              id="salud-fabrica"
              aria-labelledby="titulo-fabrica"
            >
              <CabeceraFuente
                id="titulo-fabrica"
                title="Fábrica · Producción y costes"
                source={salud.fabrica}
              />
              <dl className={"salud-metrics"}>
                <Metrica label="En producción">
                  {numero(salud.fabrica.enCurso)}
                </Metrica>
                <Metrica label="Sin avance">
                  {numero(salud.fabrica.colgados)}
                </Metrica>
                <Metrica label="Esperan aprobación">
                  {numero(salud.fabrica.aprobaciones)}
                </Metrica>
                <Metrica label="Programados">
                  {numero(salud.fabrica.programados)}
                </Metrica>
                <Metrica label="Pausados">
                  {numero(salud.fabrica.pausados)}
                </Metrica>
                <Metrica label="Cancelados">
                  {numero(salud.fabrica.cancelados)}
                </Metrica>
                <Metrica label="Publicados">
                  {numero(salud.fabrica.publicados)}
                </Metrica>
                <Metrica label="Gasto de hoy (USD)">
                  {money(salud.fabrica.gastoDiarioUsd)}
                </Metrica>
              </dl>
              <p className={"salud-muted"}>
                {salud.fabrica.gastoFuente === "simulada"
                  ? "Importes de ejemplo; no representan facturación real."
                  : salud.fabrica.gastoFuente === "n8n_estimado"
                    ? "Gastos registrados por la fábrica, con estimaciones según uso y tarifas."
                    : salud.fabrica.gastoFuente === "n8n"
                      ? "Gastos registrados por la fábrica."
                      : "Sin datos de costes disponibles."}{" "}
                Día de calendario en Lima. Registro:{" "}
                {fecha(salud.fabrica.gastoFecha)} (Lima).
              </p>
              <h3>Seguimiento de videos</h3>
              {salud.fabrica.videos.length === 0 ? (
                <p className={"salud-muted"}>
                  No hay videos en la muestra disponible.
                </p>
              ) : (
                <ul className={"salud-list"}>
                  {salud.fabrica.videos.map((video) => (
                    <li key={video.id}>
                      <div className={"salud-itemHead"}>
                        <Link href={`/videos/${encodeURIComponent(video.id)}`}>
                          {video.titulo}
                        </Link>
                        <span
                          className={
                            video.estado === "colgado"
                              ? "salud-badge"
                              : undefined
                          }
                          data-state="alerta"
                        >
                          {etiquetasVideo[video.estado]}
                        </span>
                      </div>
                      <p>
                        {ETAPAS[video.etapa] ?? "Etapa sin registrar"}
                        {video.sinAvanceMinutos !== null &&
                          ` · ${numero(video.sinAvanceMinutos, " min desde el último avance")}`}
                      </p>
                      <small>
                        Actualizado: {fecha(video.actualizado)} (Lima)
                      </small>
                    </li>
                  ))}
                </ul>
              )}
              {salud.fabrica.videosTruncados && (
                <p className={"salud-muted"}>
                  Se muestra una lista parcial. Abre Videos para consultar el
                  resto.
                </p>
              )}
              <Link href="/videos" className="button secondary">
                Abrir videos y sus controles
              </Link>
            </section>
          </>
        )}
        {data && draft && (
          <section
            className={"salud-section"}
            id="configurar-alertas"
            aria-labelledby="titulo-alertas-config"
          >
            <h2 id="titulo-alertas-config">Umbrales y avisos por Telegram</h2>
            <p className={"salud-muted"}>
              Los umbrales señalan cuándo revisar la operación. Los cambios se
              aplican después de revisarlos y guardarlos.
            </p>
            <dl className={"salud-metrics"}>
              <Metrica
                label="Telegram"
                detail={
                  data.telegram.configurado
                    ? "Destino configurado en el servidor"
                    : "Falta configurar el destino en el servidor"
                }
              >
                {data.telegram.activo ? "Activado" : "Desactivado"}
              </Metrica>
              <Metrica label="Última entrega">
                {
                  {
                    sin_envios: "Sin envíos",
                    enviado: "Enviada",
                    fallido: "Fallida",
                    incierto: "Sin confirmar",
                  }[data.telegram.entrega]
                }
              </Metrica>
              <Metrica label="Incidencias en la última evaluación">
                {data.telegram.pendientes}
              </Metrica>
            </dl>
            <p className={"salud-muted"}>
              Última evaluación: {fecha(data.telegram.ultimaEvaluacion)}. Último
              envío: {fecha(data.telegram.ultimoEnvio)} (Lima).
            </p>
            {data.telegram.entrega === "incierto" && (
              <p className="notice">
                La última entrega no pudo confirmarse. Revisa Telegram antes de
                decidir cualquier reenvío.
              </p>
            )}
            <Notice error={saveError} message={message} />
            {conflict && (
              <div className={"salud-review"} role="status">
                <p>
                  La configuración guardada cambió mientras editabas. Tus
                  cambios siguen aquí; carga la versión guardada para volver a
                  revisarlos.
                </p>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    cambiar(data.configuracion);
                    setSaveError("");
                  }}
                >
                  Cargar configuración guardada
                </button>
              </div>
            )}
            <details className="salud-controles" ref={controles}>
              <summary>Editar umbrales y avisos</summary>
              <form
                className={"salud-form"}
                onSubmit={(event) => {
                  if (review) void guardar(event);
                  else {
                    event.preventDefault();
                    setReview(true);
                    setConfirmed(false);
                    setSaveError("");
                  }
                }}
              >
                <fieldset className={"salud-fieldset"} disabled={saving}>
                  <legend>Umbrales de atención</legend>
                  <div className={"salud-fields"}>
                    {campos.map((field) => (
                      <label key={field.clave} htmlFor={`salud-${field.clave}`}>
                        {field.etiqueta}
                        <input
                          id={`salud-${field.clave}`}
                          aria-label={field.etiqueta}
                          type="number"
                          min={field.min}
                          max={field.max}
                          step={field.step ?? 1}
                          required
                          value={
                            Number.isNaN(draft.umbrales[field.clave])
                              ? ""
                              : draft.umbrales[field.clave]
                          }
                          aria-describedby={`ayuda-${field.clave}`}
                          onChange={(event) =>
                            cambiar({
                              ...draft,
                              umbrales: {
                                ...draft.umbrales,
                                [field.clave]:
                                  event.currentTarget.valueAsNumber,
                              },
                            })
                          }
                        />
                        <span
                          className={"salud-muted"}
                          id={`ayuda-${field.clave}`}
                        >
                          {field.ayuda}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className={"salud-fieldset"} disabled={saving}>
                  <legend>Entrega de avisos</legend>
                  <label className={"salud-checkbox"}>
                    <input
                      type="checkbox"
                      checked={draft.telegramActivo}
                      onChange={(event) =>
                        cambiar({
                          ...draft,
                          telegramActivo: event.target.checked,
                        })
                      }
                    />
                    Activar avisos por Telegram
                  </label>
                  <p className={"salud-muted"}>
                    Solo se envían avisos con el destino configurado. No se
                    incluyen credenciales ni contenido privado de ejecuciones.
                  </p>
                  <div className={"salud-fields"}>
                    <label htmlFor="salud-recordatorio">
                      Recordatorio de una alerta persistente (minutos)
                      <input
                        id="salud-recordatorio"
                        type="number"
                        min={15}
                        max={10080}
                        step={1}
                        required
                        value={
                          Number.isNaN(draft.recordatorioMinutos)
                            ? ""
                            : draft.recordatorioMinutos
                        }
                        onChange={(event) =>
                          cambiar({
                            ...draft,
                            recordatorioMinutos:
                              event.currentTarget.valueAsNumber,
                          })
                        }
                      />
                    </label>
                  </div>
                </fieldset>
                {review && (
                  <div className={"salud-review"}>
                    <h3>Revisa antes de guardar</h3>
                    <ul>
                      {campos.map((field) => (
                        <li key={field.clave}>
                          {field.etiqueta}:{" "}
                          <strong>{draft.umbrales[field.clave]}</strong>
                        </li>
                      ))}
                      <li>
                        Telegram:{" "}
                        <strong>
                          {draft.telegramActivo ? "activado" : "desactivado"}
                        </strong>
                      </li>
                      <li>
                        Recordatorios: cada{" "}
                        <strong>{draft.recordatorioMinutos} minutos</strong>
                      </li>
                    </ul>
                    <label className={"salud-checkbox"}>
                      <input
                        type="checkbox"
                        checked={confirmed}
                        disabled={saving}
                        onChange={(event) => setConfirmed(event.target.checked)}
                      />
                      He revisado los umbrales y la entrega de avisos.
                    </label>
                  </div>
                )}
                <button
                  className="button"
                  disabled={
                    saving || Boolean(conflict) || (review && !confirmed)
                  }
                >
                  {saving
                    ? "Guardando…"
                    : review
                      ? "Guardar configuración de alertas"
                      : "Revisar cambios"}
                </button>
              </form>
            </details>
          </section>
        )}
      </div>
    </div>
  );
}
