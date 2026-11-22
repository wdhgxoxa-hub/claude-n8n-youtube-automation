"use client";
import { useEffect, useId, useState, useRef, type FormEvent } from "react";
import Link from "next/link";
import { Plus, ArrowUpRight, Trash2, X } from "lucide-react";
import { api, useEspacio, Heading, Empty, Notice } from "./espacio";
import { Indicador } from "./movimiento";
import { LineaProduccion } from "./linea-produccion";
import styles from "./fabrica-pagina.module.css";
import { ETAPAS, esperaAprobacion } from "@/lib/etapas";
import { Cifra, HojaVidrio, Medio, Vacio } from "./primitivas";
import "./resto-diseno.css";
export function Canales() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const sheet = dialog.current;
    if (creating) sheet?.showModal();
    else sheet?.close();
  }, [creating]);
  const pending = useRef(false);
  const { data, refresh } = useEspacio();
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function execute(e: FormEvent<HTMLFormElement>, channelId?: string) {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setError("");
    setBusy(true);
    const form = e.currentTarget;
    const values = new FormData(form);
    try {
      await api("orden", {
        evento: channelId ? values.get("evento") : "nuevo_canal",
        recursoId: channelId,
        texto: values.get("texto"),
        nombre: values.get("nombre") || undefined,
      });
      await refresh();
      setMessage(
        channelId
          ? "Canal actualizado."
          : "Canal creado. Ya puedes pedir tu primer video.",
      );
      form.reset();
      setCreating(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (
      !window.confirm(
        "¿Borrar este canal y todos sus videos? Esta acción no se puede deshacer.",
      )
    )
      return;
    try {
      await api(`canales/${id}`, undefined, "DELETE");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function cambiarNoticia(id: string, activar: boolean) {
    if (pending.current) return;
    pending.current = true;
    setError("");
    setBusy(true);
    try {
      await api("orden", {
        evento: "ajustar_biblia",
        recursoId: id,
        texto: activar ? "Activar modo noticia" : "Desactivar modo noticia",
        parametros: { campo: "modo_noticia", valor: activar },
      });
      await refresh();
      setMessage(
        activar
          ? "Modo noticia activado para los próximos videos."
          : "Modo noticia desactivado para los próximos videos.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="page resto-page canales-diseno">
      <Heading
        title="Tus canales"
        description="Cada canal tiene una voz. Dale dirección."
        action={
          data.channels.length > 0 ? (
            <button
              className="button"
              onClick={() => setCreating(true)}
              aria-haspopup="dialog"
            >
              <Plus size={17} />
              Nuevo canal
            </button>
          ) : undefined
        }
      />
      {!creating && <Notice error={error} message={message} />}
      <section className="canales-coleccion" aria-label="Canales del estudio">
        {data.channels.length ? (
          data.channels.map((c, index) => {
            const videos = data.videos.filter((v) => v.channelId === c.id);
            const ultimo = videos.find((v) => v.medios?.poster) ?? videos[0];
            return (
              <article className="canal-editorial" key={c.id}>
                <div className="canal-cabecera">
                  <span className="resto-eyebrow">
                    Canal {String(index + 1).padStart(2, "0")}
                  </span>
                  <button
                    className="icon-button"
                    aria-label={`Borrar canal ${c.name}`}
                    onClick={() => void remove(c.id)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="canal-cuerpo">
                  <div className="canal-identidad">
                    <p className="canal-redes">
                      {c.networks || "Tus próximas historias"}
                    </p>
                    <h2>
                      <Link href={`/canales/${c.id}`}>
                        {c.name}
                        <ArrowUpRight size={24} aria-hidden="true" />
                      </Link>
                    </h2>
                    <p>{c.niche}</p>
                    <div className="canal-cifras">
                      <Cifra
                        etiqueta={videos.length === 1 ? "Video" : "Videos"}
                        valor={videos.length}
                      />
                      <Cifra
                        etiqueta="Publicados"
                        valor={videos.filter((v) => v.stage === 11).length}
                      />
                    </div>
                    <Link
                      className="button secondary"
                      href={`/canales/${c.id}`}
                    >
                      Abrir biblia y operación
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                  {ultimo ? (
                    <Link
                      href={`/videos/${ultimo.id}`}
                      className="canal-ultimo"
                    >
                      {ultimo.medios?.poster && (
                        <Medio
                          poster={ultimo.medios.poster.url}
                          preview={ultimo.medios.preview?.url}
                          videoId={ultimo.id}
                          proporcion={
                            ultimo.medios.relacionAspecto === 1
                              ? "cuadrado"
                              : ultimo.medios.relacionAspecto < 1
                                ? "vertical"
                                : "horizontal"
                          }
                          alt={ultimo.title}
                        />
                      )}
                      <span className="resto-eyebrow">En este canal</span>
                      <h3>{ultimo.title}</h3>
                      <span className="canal-etapa">
                        {ETAPAS[ultimo.stage]}
                      </span>
                    </Link>
                  ) : (
                    <div className="canal-sin-video">
                      <span className="resto-eyebrow">Una voz propia</span>
                      <p>El primer video empieza con una idea.</p>
                      <Link className="text-link" href="/videos">
                        Pedir un video <ArrowUpRight size={16} />
                      </Link>
                    </div>
                  )}
                </div>
                <div className="canal-pie">
                  <nav
                    aria-label={`Operación de ${c.name}, canal ${index + 1}`}
                    className="canal-enlaces"
                  >
                    <Link href={`/redes?canal=${c.id}`}>Redes</Link>
                    <Link href={`/rutina?canal=${c.id}`}>Metas</Link>
                    <Link href={`/cuentas?canal=${c.id}`}>Adoptar cuenta</Link>
                  </nav>
                  <details className="canal-noticias">
                    <summary>
                      Noticias {c.newsMode ? "activadas" : "en pausa"}
                    </summary>
                    <p>
                      Noticias del día con fuentes verificadas e imágenes
                      propias.
                    </p>
                    <button
                      className="button secondary"
                      aria-pressed={c.newsMode}
                      aria-label={`Modo noticia: ${c.newsMode ? "activado" : "desactivado"} de ${c.name}`}
                      disabled={busy}
                      onClick={() => void cambiarNoticia(c.id, !c.newsMode)}
                    >
                      Modo noticia: {c.newsMode ? "activado" : "desactivado"}
                    </button>
                  </details>
                </div>
              </article>
            );
          })
        ) : (
          <Vacio
            titulo="Un espacio para tu primera historia"
            descripcion="Elige un tema que te interese y a quién quieres contárselo. Cooper usará esa dirección en cada guion."
            accion={
              <button
                className="button"
                onClick={() => setCreating(true)}
                aria-haspopup="dialog"
              >
                Dar nombre a mi canal
                <ArrowUpRight size={17} />
              </button>
            }
          />
        )}
      </section>
      <dialog
        ref={dialog}
        className="resto-dialog"
        aria-labelledby="nuevo-canal-titulo"
        onCancel={() => setCreating(false)}
        // El evento `close` llega en una tarea aparte: si la hoja se reabrió
        // antes (Escape y Enter seguidos), un cierre atrasado no debe volver a
        // cerrarla. Solo se sincroniza el estado si el diálogo sigue cerrado.
        onClose={(event) => {
          if (!event.currentTarget.open) setCreating(false);
        }}
      >
        <HojaVidrio className="resto-hoja">
          <div className="resto-hoja-cabecera">
            <span className="resto-eyebrow">Un nuevo comienzo</span>
            <button
              className="icon-button"
              aria-label="Cerrar nuevo canal"
              onClick={() => setCreating(false)}
            >
              <X size={20} />
            </button>
          </div>
          <h2 id="nuevo-canal-titulo">Un nuevo canal</h2>
          <p>El punto de partida para tus próximos videos.</p>
          {creating && <Notice error={error} />}
          <form className="stack" onSubmit={execute} aria-busy={busy}>
            <label>
              Nombre del canal
              <input
                name="nombre"
                autoFocus
                placeholder="Ciencia cotidiana"
                required
                maxLength={120}
              />
            </label>
            <label>
              ¿De qué trata?
              <textarea
                name="texto"
                placeholder="Ciencia explicada con ejemplos simples, para personas curiosas."
                required
                maxLength={6000}
                rows={4}
              />
            </label>
            <button className="button" disabled={busy}>
              Crear canal
            </button>
          </form>
        </HojaVidrio>
      </dialog>
    </div>
  );
}

export function Videos() {
  const formId = useId();
  const pending = useRef(false);
  const createButton = useRef<HTMLButtonElement>(null);
  const createForm = useRef<HTMLFormElement>(null);
  const restoreFocus = useRef(false);
  const { data, refresh } = useEspacio();
  const [filter, setFilter] = useState("todos"),
    [creating, setCreating] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!creating && !busy && restoreFocus.current) {
      restoreFocus.current = false;
      if (document.activeElement === document.body)
        createButton.current?.focus();
    }
  }, [creating, busy]);
  useEffect(() => {
    // Al abrirse, el formulario entero (con «Enviar» y «Cancelar») queda a la
    // vista sobre la barra móvil fija: scroll-padding-bottom marca su zona.
    if (creating)
      createForm.current?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
  }, [creating]);
  function closeCreate() {
    restoreFocus.current = true;
    setCreating(false);
  }
  const visible = data.videos.filter(
    (v) =>
      filter === "todos" ||
      (filter === "pendientes"
        ? esperaAprobacion(v.stage)
        : filter === "publicados"
          ? v.stage === 11
          : v.stage < 11 && !esperaAprobacion(v.stage)),
  );
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setError("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await api("orden", {
        evento: "nuevo_video",
        recursoId: f.get("canal"),
        texto: f.get("titulo"),
        avatarId: f.get("avatarId"),
        voiceId: f.get("voiceId"),
        avatarPlacement: f.get("avatarPlacement"),
      });
      await refresh();
      closeCreate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const filtros = (
    <div className="filters" role="group" aria-label="Filtrar videos">
      {[
        ["todos", "Todos"],
        ["proceso", "En producción"],
        ["pendientes", "Por aprobar"],
        ["publicados", "Publicados"],
      ].map(([id, label]) => (
        <button
          key={id}
          aria-pressed={filter === id}
          onClick={() => setFilter(id)}
        >
          {filter === id && <Indicador id="filtro-videos" />}
          {label}
        </button>
      ))}
    </div>
  );
  return (
    <div className={`page ${styles.page}`}>
      <Heading
        title="Línea de producción"
        description="De la primera idea a la última mirada. Cada historia, a su ritmo."
        action={
          <button
            ref={createButton}
            className="button"
            aria-expanded={creating}
            aria-controls={creating ? formId : undefined}
            disabled={busy}
            onClick={() => (creating ? closeCreate() : setCreating(true))}
          >
            <Plus size={17} />
            Pedir video
          </button>
        }
      />
      <Notice error={error} />
      {creating && (
        <form
          ref={createForm}
          id={formId}
          className="inline-form"
          onSubmit={create}
          aria-busy={busy}
        >
          <h2>¿Qué vamos a contar?</h2>
          <label>
            Canal
            <select name="canal" required autoFocus>
              <option value="">Selecciona un canal</option>
              {data.channels
                .filter((c) => c.ownerId === data.user.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Idea del video
            <input
              name="titulo"
              required
              maxLength={160}
              placeholder="Por qué el cielo es azul"
            />
          </label>
          <label>
            Presentador
            <select name="avatarId">
              <option value="">Sin presentador</option>
              {[
                ...data.catalogo,
                ...data.assets.filter(
                  (a) => a.verified && a.status === "listo",
                ),
              ]
                .filter((a) => a.kind === "avatar")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Voz
            <select name="voiceId">
              <option value="">Elegir según el guion</option>
              {[
                ...data.catalogo,
                ...data.assets.filter(
                  (a) => a.verified && a.status === "listo",
                ),
              ]
                .filter((a) => a.kind === "voz")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Presencia del avatar
            <select name="avatarPlacement">
              <option value="partes">Solo en algunas partes</option>
              <option value="completo">Durante todo el video</option>
            </select>
          </label>
          <div className="button-row">
            <button className="button" disabled={busy}>
              Enviar a la fábrica
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={closeCreate}
            >
              Cancelar
            </button>
          </div>
          {data.channels.length === 0 && (
            <Link href="/canales">Primero crea tu canal</Link>
          )}
        </form>
      )}
      {visible.length ? (
        <LineaProduccion videos={visible} filtros={filtros} />
      ) : (
        <>
          {filtros}
          <Empty
            title={
              filter === "todos" ? "Tu primera idea va aquí" : "Todo al día"
            }
            description={
              filter === "todos"
                ? "Pide un video y sigue su recorrido de principio a fin."
                : "No hay videos en este estado."
            }
          />
        </>
      )}
    </div>
  );
}
export { DetalleVideo } from "./detalle-video";
