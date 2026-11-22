"use client";

import {
  useId,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  PencilLine,
  Trash2,
  X,
} from "lucide-react";
import { ETAPAS, esperaAprobacion } from "@/lib/etapas";
import type { Orden } from "@/servicios/fabrica";
import type { Estado } from "@/servicios/datos";
import { api, useEspacio, Empty, Notice } from "./espacio";
import { Recorrido } from "./fabrica-vista";
import { MediosVideo } from "./medios-video";
import { Boton, Cifra } from "./primitivas";
import styles from "./detalle-video.module.css";

type Video = Estado["videos"][number];
const PESTANAS = ["Guion", "Métricas", "Lecciones"] as const;
type Pestana = (typeof PESTANAS)[number];

function fechaLima(value: string | number) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

function MetricasVideo({ video }: { video: Video }) {
  const publicaciones = video.observabilidad.publicaciones;
  if (!publicaciones.length)
    return (
      <div className={styles.vacio}>
        <span className={styles.kicker}>Después del estreno</span>
        <h2>La historia sigue con tu audiencia.</h2>
        <p>
          Cuando se publique, aquí verás las vistas, la respuesta y la retención
          de cada red.
        </p>
      </div>
    );
  return (
    <div className={styles.publicaciones}>
      {publicaciones.map((publicacion) => {
        const historial = [...publicacion.historial].sort(
          (a, b) => Date.parse(a.fecha) - Date.parse(b.fecha),
        );
        const ultima = historial.at(-1);
        return (
          <section
            className={styles.publicacion}
            key={publicacion.id}
            aria-label={`Métricas de ${publicacion.red}`}
          >
            <div className={styles.seccionCabecera}>
              <div>
                <span className={styles.kicker}>
                  {ultima
                    ? `Medido ${fechaLima(ultima.fecha)} · Lima`
                    : "Aún sin mediciones"}
                </span>
                <h2>{publicacion.red}</h2>
              </div>
              {publicacion.url && (
                <a
                  className="text-link"
                  href={publicacion.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver publicación <ArrowUpRight size={16} />
                </a>
              )}
            </div>
            <div className={styles.cifras}>
              <Cifra
                etiqueta="Vistas"
                valor={ultima?.vistas ?? null}
                serie={historial.flatMap((m) =>
                  m.vistas === null ? [] : [m.vistas],
                )}
              />
              <Cifra etiqueta="Me gusta" valor={ultima?.meGusta ?? null} />
              <Cifra
                etiqueta="Comentarios"
                valor={ultima?.comentarios ?? null}
              />
              <Cifra
                etiqueta="Retención media (%)"
                valor={ultima?.retencion ?? null}
              />
            </div>
            {ultima?.seguidoresGanados != null && (
              <p className={styles.nota}>
                {new Intl.NumberFormat("es-PE").format(
                  ultima.seguidoresGanados,
                )}{" "}
                seguidores ganados en esta medición.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function DetalleVideo({ id }: { id: string }) {
  const { data, refresh } = useEspacio();
  const video = data.videos.find((v) => v.id === id);
  const pending = useRef(false);
  const tabId = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const origenFormulario = useRef<HTMLButtonElement | null>(null);
  const recuperarFoco = useRef(false);
  const [pestana, setPestana] = useState<Pestana>("Guion");
  const [formulario, setFormulario] = useState<"corregir" | "programar" | null>(
    null,
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (formulario || busy || !recuperarFoco.current) return;
    recuperarFoco.current = false;
    origenFormulario.current?.focus();
  }, [formulario, busy]);

  function cerrarFormulario() {
    recuperarFoco.current = true;
    setFormulario(null);
  }

  async function act(path: string, value: unknown, exito: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(path, value);
      await refresh();
      setMessage(exito);
      if (formulario) cerrarFormulario();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function cambiarPestana(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const siguiente =
      event.key === "ArrowRight"
        ? (index + 1) % PESTANAS.length
        : event.key === "ArrowLeft"
          ? (index + PESTANAS.length - 1) % PESTANAS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? PESTANAS.length - 1
              : null;
    if (siguiente === null) return;
    event.preventDefault();
    setPestana(PESTANAS[siguiente]);
    tabs.current[siguiente]?.focus();
  }

  async function order(
    event: FormEvent<HTMLFormElement>,
    evento: Orden["evento"],
  ) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    let texto = String(values.get("texto"));
    if (evento === "programar") {
      const fecha = new Date(texto);
      if (!Number.isFinite(fecha.getTime())) {
        setError("Elige una fecha y una hora válidas.");
        return;
      }
      texto = fecha.toISOString();
    }
    await act(
      "orden",
      { evento, recursoId: id, texto },
      evento === "programar"
        ? "Fecha guardada. La publicación espera tus aprobaciones."
        : "Referencias guardadas.",
    );
  }

  if (!video)
    return (
      <div className="page">
        <Empty
          title="Video no disponible"
          description="Puede haberse eliminado o pertenecer a otro espacio."
        >
          <Link href="/videos" className="button">
            Volver a la fábrica
          </Link>
        </Empty>
      </div>
    );

  const canal = data.channels.find((c) => c.id === video.channelId);
  const own = video.ownerId === data.user.id || data.user.role === "admin";
  const cancelled = video.productionState === "cancelada";
  const enPausa = video.productionState === "pausada";
  const necesitaMirada = esperaAprobacion(video.stage);
  const estado = cancelled
    ? "Cancelado"
    : enPausa
      ? "En pausa"
      : ETAPAS[video.stage];
  const lecciones = (canal?.lecciones ?? []).filter(
    (l) =>
      l.origenes?.some((o) => o.videoId === video.id) ||
      l.aplicaciones?.some((a) => a.videoId === video.id),
  );
  const puedeEditar = own && !cancelled;
  const tieneRecursos =
    video.observabilidad.escenas.length > 0 ||
    video.observabilidad.publicaciones.length > 0;

  return (
    <div className={`page ${styles.pagina}`} data-video-detalle={video.id}>
      <div className={styles.breadcrumb}>
        <Link href="/videos" className={styles.volver}>
          <ArrowLeft size={16} /> Fábrica
        </Link>
        <span>Sala de proyección</span>
      </div>
      <Notice error={error} message={message} />
      {video.productionNotice && (
        <p className="notice" role="status">
          {video.productionNotice}
        </p>
      )}
      <section className={styles.heroe} aria-labelledby={`${tabId}-titulo`}>
        <div className={styles.proyeccion}>
          <MediosVideo
            key={video.id}
            videoId={video.id}
            datos={video.observabilidad}
            titulo={video.title}
            inicial={video.medios}
            seccion="reproductor"
          />
        </div>
        <div className={styles.direccion}>
          <div className={styles.identidad}>
            <span className={styles.kicker}>{canal?.name ?? "Tu canal"}</span>
            <h1 id={`${tabId}-titulo`}>{video.title}</h1>
            <span
              className={styles.estado}
              data-espera={!cancelled && necesitaMirada}
            >
              <i aria-hidden="true" />
              {estado}
            </span>
          </div>
          <div className={styles.decision}>
            <p>
              {cancelled
                ? "Tu elección se conserva. Esta producción ya no admite cambios."
                : necesitaMirada
                  ? "Dale una última mirada. El siguiente paso lo decides tú."
                  : video.stage === 11
                    ? "Ya está en el mundo. Mira cómo responde tu audiencia."
                    : "Cada etapa prepara la siguiente. Te avisamos cuando necesitemos tu mirada."}
            </p>
            <div className={styles.acciones}>
              <Boton
                className={styles.aprobar}
                disabled={busy || !puedeEditar || !necesitaMirada}
                onClick={() =>
                  void act(
                    `videos/${id}/aprobar`,
                    {},
                    "Aprobado. La fábrica continúa.",
                  )
                }
              >
                <Check size={18} /> Aprobar
              </Boton>
              <Boton
                variante="secundario"
                disabled={busy || !puedeEditar || video.stage === 11}
                aria-expanded={formulario === "corregir"}
                aria-controls={`${tabId}-accion`}
                onClick={(event) => {
                  origenFormulario.current = event.currentTarget;
                  setFormulario(formulario === "corregir" ? null : "corregir");
                }}
              >
                <PencilLine size={16} /> Pedir cambios
              </Boton>
              <Boton
                variante="secundario"
                disabled={busy || !puedeEditar}
                aria-expanded={formulario === "programar"}
                aria-controls={`${tabId}-accion`}
                onClick={(event) => {
                  origenFormulario.current = event.currentTarget;
                  setFormulario(
                    formulario === "programar" ? null : "programar",
                  );
                }}
              >
                <CalendarDays size={16} /> Programar
              </Boton>
            </div>
            {video.scheduledAt && (
              <p className={styles.programado}>
                Programado para el {fechaLima(video.scheduledAt)} · Lima
              </p>
            )}
          </div>
        </div>
      </section>

      <div id={`${tabId}-accion`}>
        {formulario && puedeEditar && (
          <section
            className={styles.edicion}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !busy) {
                event.preventDefault();
                cerrarFormulario();
              }
            }}
            aria-label={
              formulario === "corregir"
                ? "Pedir cambios"
                : "Programar publicación"
            }
          >
            <div className={styles.seccionCabecera}>
              <div>
                <span className={styles.kicker}>Tu dirección</span>
                <h2>
                  {formulario === "corregir"
                    ? "Hagámoslo más tuyo."
                    : "Elige su momento."}
                </h2>
              </div>
              <Boton
                variante="fantasma"
                aria-label="Cerrar formulario"
                onClick={cerrarFormulario}
              >
                <X size={18} />
              </Boton>
            </div>
            {formulario === "corregir" ? (
              <form
                className="stack changes-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void act(
                    `videos/${id}/cambios`,
                    { texto: new FormData(event.currentTarget).get("texto") },
                    "Indicación enviada. Cooper prepara los cambios.",
                  );
                }}
              >
                <label>
                  ¿Qué cambiamos?
                  <textarea
                    name="texto"
                    autoFocus
                    required
                    minLength={3}
                    maxLength={6000}
                    rows={4}
                    placeholder="Cuéntanos qué ajustar en el guion, el ritmo o las imágenes."
                  />
                </label>
                <Boton type="submit" disabled={busy}>
                  Enviar cambios
                </Boton>
              </form>
            ) : (
              <form
                className="stack"
                onSubmit={(event) => void order(event, "programar")}
              >
                <p className={styles.nota}>
                  La publicación espera ambas aprobaciones. La hora se guarda
                  desde la zona horaria de tu dispositivo.
                </p>
                <label>
                  Fecha y hora local
                  <input
                    name="texto"
                    type="datetime-local"
                    required
                    autoFocus
                  />
                </label>
                <Boton type="submit" disabled={busy}>
                  Programar publicación
                </Boton>
              </form>
            )}
          </section>
        )}
      </div>

      <section className={styles.progreso} aria-label="Recorrido de producción">
        <div className={styles.progresoTitulo}>
          <span>El recorrido</span>
          <span className={styles.numeracion}>
            {String(video.stage + 1).padStart(2, "0")} / 12
          </span>
        </div>
        <div
          className={styles.pista}
          tabIndex={0}
          role="region"
          aria-label={`Etapas del video. Etapa actual: ${estado}`}
        >
          <Recorrido
            stage={video.stage}
            productionState={video.productionState}
          />
        </div>
      </section>

      <div className={styles.archivo}>
        <div
          className={styles.pestanas}
          role="tablist"
          aria-label="Contenido del video"
        >
          {PESTANAS.map((nombre, index) => (
            <button
              key={nombre}
              ref={(element) => {
                tabs.current[index] = element;
              }}
              id={`${tabId}-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={pestana === nombre}
              aria-controls={`${tabId}-panel-${index}`}
              tabIndex={pestana === nombre ? 0 : -1}
              onClick={() => setPestana(nombre)}
              onKeyDown={(event) => cambiarPestana(event, index)}
            >
              {nombre}
            </button>
          ))}
        </div>
        <section
          id={`${tabId}-panel-0`}
          role="tabpanel"
          aria-labelledby={`${tabId}-tab-0`}
          tabIndex={0}
          hidden={pestana !== "Guion"}
          className={styles.panel}
        >
          <div className={styles.guionComposicion}>
            <div className={styles.guion}>
              <div className={styles.seccionCabecera}>
                <h2>El guion</h2>
                <span className={styles.kicker}>Versión de trabajo</span>
              </div>
              <div className={styles.textoGuion}>
                {video.script
                  .split("\n\n")
                  .filter((p) => p.trim())
                  .map((p, i) => (
                    <p key={i}>{p.replace(/^# /, "")}</p>
                  ))}
              </div>
              {!video.script.trim() && (
                <p className={styles.nota}>
                  El guion aparecerá aquí cuando esté listo para leer.
                </p>
              )}
              {video.feedback && (
                <div className={styles.indicacion}>
                  <span className={styles.kicker}>Tu última indicación</span>
                  <p>{video.feedback}</p>
                </div>
              )}
            </div>
            <aside className={styles.notas} aria-label="Notas de producción">
              <span className={styles.kicker}>Detrás de la historia</span>
              <h3>Notas de producción</h3>
              {(video.avatarId || video.voiceId) && (
                <div className={`presenter-summary ${styles.presentador}`}>
                  <span>
                    Presentador:{" "}
                    {[...data.catalogo, ...data.assets].find(
                      (a) => a.id === video.avatarId,
                    )?.name ??
                      (video.avatarId
                        ? "Presentador elegido no disponible"
                        : "Sin presentador")}
                  </span>
                  <span>
                    Voz:{" "}
                    {[...data.catalogo, ...data.assets].find(
                      (a) => a.id === video.voiceId,
                    )?.name ??
                      (video.voiceId
                        ? "Voz elegida no disponible"
                        : "Según el guion")}
                  </span>
                  <span>
                    {video.avatarPlacement === "completo"
                      ? "En todo el video"
                      : "En algunas partes"}
                  </span>
                </div>
              )}
              {puedeEditar ? (
                <details className={styles.referencias}>
                  <summary>Referencias y publicación</summary>
                  <p className={styles.nota}>
                    {video.scheduledAt
                      ? `Publicación: ${fechaLima(video.scheduledAt)} (Lima)`
                      : "La publicación espera ambas aprobaciones."}
                  </p>
                  <form
                    className="stack"
                    onSubmit={(event) => void order(event, "referencias")}
                  >
                    <label>
                      Referencias
                      <textarea
                        name="texto"
                        defaultValue={video.references}
                        maxLength={6000}
                        required
                        rows={4}
                      />
                    </label>
                    <Boton variante="secundario" type="submit" disabled={busy}>
                      Guardar referencias
                    </Boton>
                  </form>
                </details>
              ) : (
                video.references && (
                  <p className={styles.nota}>{video.references}</p>
                )
              )}
              <p className={styles.nota}>
                Creado el {fechaLima(video.createdAt)} · Lima
              </p>
            </aside>
          </div>
          {tieneRecursos && (
            <details className={styles.recursos}>
              <summary>Piezas de la historia y publicaciones</summary>
              <MediosVideo
                videoId={video.id}
                datos={video.observabilidad}
                titulo={video.title}
                inicial={video.medios}
                seccion="recursos"
              />
            </details>
          )}
        </section>
        <section
          id={`${tabId}-panel-1`}
          role="tabpanel"
          aria-labelledby={`${tabId}-tab-1`}
          tabIndex={0}
          hidden={pestana !== "Métricas"}
          className={styles.panel}
        >
          <MetricasVideo video={video} />
        </section>
        <section
          id={`${tabId}-panel-2`}
          role="tabpanel"
          aria-labelledby={`${tabId}-tab-2`}
          tabIndex={0}
          hidden={pestana !== "Lecciones"}
          className={styles.panel}
        >
          {lecciones.length ? (
            <div className={styles.lecciones}>
              {lecciones.map((leccion, index) => (
                <article key={leccion.id} className={styles.leccion}>
                  <span className={styles.numeroLeccion}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <span className={styles.kicker}>
                      {leccion.nivel === "patron"
                        ? "Patrón observado"
                        : "Hipótesis por contrastar"}{" "}
                      · {fechaLima(leccion.fecha)}
                    </span>
                    <h2>{leccion.resumen}</h2>
                    {leccion.causa && (
                      <p>
                        <strong>Qué observamos.</strong> {leccion.causa}
                      </p>
                    )}
                    {leccion.correccion && (
                      <p>
                        <strong>Qué cambia.</strong> {leccion.correccion}
                      </p>
                    )}
                    {leccion.aplicaciones
                      ?.filter((a) => a.videoId === video.id)
                      .map((a, i) => (
                        <p key={i}>
                          <strong>En este video.</strong> {a.cambio}
                        </p>
                      ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.vacio}>
              <span className={styles.kicker}>
                Una historia enseña a la siguiente
              </span>
              <h2>Todavía estamos escuchando.</h2>
              <p>
                Cuando haya una lección vinculada a este video, verás qué
                aprendimos y qué podemos cambiar.
              </p>
            </div>
          )}
        </section>
      </div>
      {own && (
        <footer className={styles.pie}>
          <span>Esta historia es parte de {canal?.name ?? "tu canal"}.</span>
          <Boton
            variante="fantasma"
            className={styles.borrar}
            disabled={busy}
            onClick={async () => {
              if (pending.current || !window.confirm("¿Borrar este video?"))
                return;
              pending.current = true;
              setBusy(true);
              setError("");
              try {
                await api(`videos/${id}`, undefined, "DELETE");
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                pending.current = false;
                setBusy(false);
              }
            }}
          >
            <Trash2 size={15} /> Borrar video
          </Boton>
        </footer>
      )}
    </div>
  );
}
