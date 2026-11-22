"use client";
import { useEffect, useId, useState, useRef, type FormEvent } from "react";
import Link from "next/link";
import { Plus, ArrowUpRight, Trash2, Radio } from "lucide-react";
import { api, useEspacio, Heading, Empty, Notice } from "./espacio";
import { Indicador } from "./movimiento";
import { LineaProduccion } from "./linea-produccion";
import styles from "./fabrica-pagina.module.css";
import { esperaAprobacion } from "@/lib/etapas";
export function Canales() {
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
    <div className="page">
      <Heading
        title="Tus canales"
        description="Cada canal tiene una voz. Dale dirección."
      />
      <Notice error={error} message={message} />
      <div className="management-layout">
        <section className="channel-list">
          {data.channels.length ? (
            data.channels.map((c, index) => (
              <article className="channel-card" key={c.id}>
                <div className="channel-heading">
                  <span className="channel-symbol">
                    <Radio size={24} />
                  </span>
                  <div>
                    <small>{c.networks || "Identidad del canal"}</small>
                    <h2>{c.name}</h2>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Borrar canal ${c.name}`}
                    onClick={() => void remove(c.id)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <p>{c.niche}</p>
                <Link className="button secondary" href={`/canales/${c.id}`}>
                  Abrir biblia y operación
                </Link>
                <button
                  className="button secondary"
                  aria-pressed={c.newsMode}
                  aria-label={`Modo noticia: ${c.newsMode ? "activado" : "desactivado"} de ${c.name}`}
                  disabled={busy}
                  onClick={() => void cambiarNoticia(c.id, !c.newsMode)}
                >
                  Modo noticia: {c.newsMode ? "activado" : "desactivado"}
                </button>
                <p className="muted">
                  Noticias del día con fuentes verificadas e imágenes didácticas
                  propias.
                </p>
                <div className="channel-meta">
                  <span>
                    {data.videos.filter((v) => v.channelId === c.id).length}{" "}
                    {data.videos.filter((v) => v.channelId === c.id).length ===
                    1
                      ? "video"
                      : "videos"}
                  </span>
                  <Link href="/videos" className="text-link">
                    Ver producción <ArrowUpRight size={14} />
                  </Link>
                </div>
                <nav
                  aria-label={`Operación de ${c.name}, canal ${index + 1}`}
                  className="button-row"
                >
                  <Link href={`/redes?canal=${c.id}`}>Redes</Link>
                  <Link href={`/rutina?canal=${c.id}`}>Metas</Link>
                  <Link href={`/cuentas?canal=${c.id}`}>Adoptar cuenta</Link>
                </nav>
              </article>
            ))
          ) : (
            <Empty
              title="Un espacio para tu primera historia"
              description="Elige un tema que te interese y a quién quieres contárselo. Cooper usará esa dirección en cada guion."
            >
              <a href="#nuevo-canal" className="button secondary">
                Dar nombre a mi canal
              </a>
            </Empty>
          )}
        </section>
        <aside className="form-panel" id="nuevo-canal">
          <span className="panel-icon">
            <Plus size={23} />
          </span>
          <h2>Un nuevo canal</h2>
          <p>El punto de partida para tus próximos videos.</p>
          <form className="stack" onSubmit={execute}>
            <label>
              Nombre del canal
              <input
                name="nombre"
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
        </aside>
      </div>
    </div>
  );
}
export function Videos() {
  const formId = useId();
  const pending = useRef(false);
  const createButton = useRef<HTMLButtonElement>(null);
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
      {visible.length ? (
        <LineaProduccion videos={visible} />
      ) : (
        <Empty
          title={filter === "todos" ? "Tu primera idea va aquí" : "Todo al día"}
          description={
            filter === "todos"
              ? "Pide un video y sigue su recorrido de principio a fin."
              : "No hay videos en este estado."
          }
        />
      )}
    </div>
  );
}
export { DetalleVideo } from "./detalle-video";
