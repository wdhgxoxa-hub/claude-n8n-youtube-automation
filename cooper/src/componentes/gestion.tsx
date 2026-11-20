"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  Trash2,
  Radio,
  Check,
  Play,
  Pause,
} from "lucide-react";
import { motion } from "framer-motion";
import { api, useEspacio, Heading, Empty, Notice } from "./espacio";
import { Recorrido, VideoMini } from "./fabrica-vista";
import { ETAPAS, esperaAprobacion } from "@/lib/etapas";
import type { Orden } from "@/servicios/fabrica";
export function Canales() {
  const { data, refresh } = useEspacio();
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function execute(e: FormEvent<HTMLFormElement>, channelId?: string) {
    e.preventDefault();
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
                    <small>Canal {String(index + 1).padStart(2, "0")}</small>
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
                <div className="channel-meta">
                  <span>
                    {data.videos.filter((v) => v.channelId === c.id).length}{" "}
                    videos
                  </span>
                  <Link href="/videos" className="text-link">
                    Ver producción <ArrowUpRight size={14} />
                  </Link>
                </div>
                <details>
                  <summary>Identidad y conexiones</summary>
                  <dl className="channel-data">
                    {[
                      ["Biblia", c.bible],
                      ["Redes", c.networks],
                      ["Metas", c.goals],
                      ["Cuenta", c.account],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value || "Por definir"}</dd>
                      </div>
                    ))}
                  </dl>
                  {(c.ownerId === data.user.id ||
                    data.user.role === "admin") && (
                    <form
                      onSubmit={(e) => void execute(e, c.id)}
                      className="stack"
                    >
                      <label>
                        Qué quieres ajustar
                        <select name="evento">
                          <option value="ajustar_biblia">
                            Biblia del canal
                          </option>
                          <option value="configurar_redes">
                            Redes sociales
                          </option>
                          <option value="metas">Metas</option>
                          <option value="adoptar_cuenta">
                            Cuenta existente
                          </option>
                        </select>
                      </label>
                      <label>
                        Instrucciones
                        <textarea
                          name="texto"
                          required
                          maxLength={6000}
                          rows={3}
                        />
                      </label>
                      <button className="button secondary" disabled={busy}>
                        Guardar cambios
                      </button>
                    </form>
                  )}
                </details>
              </article>
            ))
          ) : (
            <Empty
              title="Un espacio para tu primera historia"
              description="Crea un canal y define de qué quieres hablar."
            />
          )}
        </section>
        <aside className="form-panel">
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
  const { data, refresh } = useEspacio();
  const [filter, setFilter] = useState("todos"),
    [creating, setCreating] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
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
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await api("orden", {
        evento: "nuevo_video",
        recursoId: f.get("canal"),
        texto: f.get("titulo"),
      });
      await refresh();
      setCreating(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page">
      <Heading
        title="Tus videos"
        description="Ideas en movimiento. Historias listas para salir."
        action={
          <button className="button" onClick={() => setCreating(!creating)}>
            <Plus size={17} />
            Pedir video
          </button>
        }
      />
      <Notice error={error} />
      {creating && (
        <form className="inline-form" onSubmit={create}>
          <h2>¿Qué vamos a contar?</h2>
          <label>
            Canal
            <select name="canal" required>
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
              autoFocus
              name="titulo"
              required
              maxLength={160}
              placeholder="Por qué el cielo es azul"
            />
          </label>
          <div className="button-row">
            <button className="button" disabled={busy}>
              Enviar a la fábrica
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setCreating(false)}
            >
              Cancelar
            </button>
          </div>
          {data.channels.length === 0 && (
            <Link href="/canales">Primero crea tu canal</Link>
          )}
        </form>
      )}
      <div className="filters" aria-label="Filtrar videos">
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
            {label}
          </button>
        ))}
      </div>
      {visible.length ? (
        <div className="video-list">
          {visible.map((v) => (
            <div className="video-list-row" key={v.id}>
              <VideoMini video={v} />
              <div
                className="mini-stages"
                role="img"
                aria-label={`Etapa ${v.stage + 1} de 12`}
              >
                {ETAPAS.map((name, i) => (
                  <span
                    title={name}
                    key={name}
                    className={
                      i < v.stage ? "done" : i === v.stage ? "active" : ""
                    }
                  />
                ))}
              </div>
              <span className="video-date">
                {new Intl.DateTimeFormat("es", {
                  day: "numeric",
                  month: "short",
                }).format(v.createdAt)}
              </span>
            </div>
          ))}
        </div>
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
export function DetalleVideo({ id }: { id: string }) {
  const { data, refresh } = useEspacio();
  const video = data.videos.find((v) => v.id === id);
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [playing, setPlaying] = useState(false),
    [changes, setChanges] = useState(false);
  async function act(path: string, value: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(path, value);
      await refresh();
      setMessage("Cambios guardados. La fábrica continúa.");
      setChanges(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!video)
    return (
      <div className="page">
        <Empty
          title="Video no disponible"
          description="Puede haberse eliminado o pertenecer a otro espacio."
        >
          <Link href="/videos" className="button">
            Volver a videos
          </Link>
        </Empty>
      </div>
    );
  const own = video.ownerId === data.user.id || data.user.role === "admin";
  async function order(e: FormEvent<HTMLFormElement>, evento: Orden["evento"]) {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    let texto = String(values.get("texto"));
    if (evento === "programar") texto = new Date(texto).toISOString();
    await act("orden", { evento, recursoId: id, texto });
  }
  return (
    <div className="page">
      <Link href="/videos" className="back-link">
        Videos / Detalle
      </Link>
      <Heading
        title={video.title}
        description={`${data.channels.find((c) => c.id === video.channelId)?.name ?? "Canal"} · ${ETAPAS[video.stage]}`}
      />
      <Notice error={error} message={message} />
      <div className="detail-layout">
        <div>
          <section className="preview" aria-label="Vista previa simulada">
            <motion.div
              className="preview-orbits"
              animate={playing ? { rotate: 360 } : { rotate: 0 }}
              transition={
                playing
                  ? { duration: 18, repeat: Infinity, ease: "linear" }
                  : { duration: 0.3 }
              }
            >
              <svg viewBox="0 0 500 260" aria-hidden="true">
                <circle cx="250" cy="130" r="80" />
                <ellipse
                  cx="250"
                  cy="130"
                  rx="160"
                  ry="50"
                  transform="rotate(-20 250 130)"
                />
                <ellipse
                  cx="250"
                  cy="130"
                  rx="55"
                  ry="110"
                  transform="rotate(-20 250 130)"
                />
                <circle cx="387" cy="77" r="7" className="planet" />
              </svg>
            </motion.div>
            <div className="preview-content">
              <span>Vista previa simulada</span>
              <h2>{video.title}</h2>
              <button
                className="preview-play"
                onClick={() => setPlaying(!playing)}
                aria-label={
                  playing ? "Pausar vista previa" : "Reproducir vista previa"
                }
              >
                {playing ? <Pause size={22} /> : <Play size={22} />}
              </button>
            </div>
            <div className="preview-footer">
              <span>9:16 · 60 segundos</span>
              <span>
                {playing ? "Reproduciendo maqueta" : "Maqueta de producción"}
              </span>
            </div>
          </section>
          <section className="script-panel">
            <div className="section-top">
              <h2>El guion</h2>
              <span className="muted">Versión de trabajo</span>
            </div>
            <div className="script-text">
              {video.script.split("\n\n").map((p, i) => (
                <p key={i}>{p.replace(/^# /, "")}</p>
              ))}
            </div>
            {video.feedback && (
              <div className="feedback">
                <strong>Tu última indicación</strong>
                <p>{video.feedback}</p>
              </div>
            )}
          </section>
          {own && (
            <details className="production-details">
              <summary>Referencias y publicación</summary>
              <p className="muted">
                {video.scheduledAt
                  ? `Publicación: ${new Date(video.scheduledAt).toLocaleString("es")}`
                  : "La publicación espera ambas aprobaciones."}
              </p>
              <form
                className="stack"
                onSubmit={(e) => void order(e, "programar")}
              >
                <label>
                  Fecha y hora local
                  <input name="texto" type="datetime-local" required />
                </label>
                <button className="button secondary" disabled={busy}>
                  Programar publicación
                </button>
              </form>
              <form
                className="stack"
                onSubmit={(e) => void order(e, "referencias")}
              >
                <label>
                  Referencias
                  <textarea
                    name="texto"
                    defaultValue={video.references}
                    maxLength={6000}
                    required
                    rows={3}
                  />
                </label>
                <button className="button secondary" disabled={busy}>
                  Guardar referencias
                </button>
              </form>
            </details>
          )}
        </div>
        <aside className="review-panel">
          <h2>
            {esperaAprobacion(video.stage)
              ? "Tu mirada hace la diferencia."
              : "Así va tu video."}
          </h2>
          <p>
            {esperaAprobacion(video.stage)
              ? "Revisa el contenido. Avanzamos cuando nos des el visto bueno."
              : "Cada etapa prepara la siguiente. Te avisamos cuando necesitemos tu aprobación."}
          </p>
          <div className="review-actions">
            <button
              className="button"
              disabled={busy || !esperaAprobacion(video.stage)}
              onClick={() => void act(`videos/${id}/aprobar`, {})}
            >
              <Check size={17} />
              Aprobar
            </button>
            <button
              className="button secondary"
              disabled={busy || video.stage === 11}
              onClick={() => setChanges(!changes)}
            >
              Pedir cambios
            </button>
          </div>
          {changes && (
            <form
              className="stack changes-form"
              onSubmit={(e) => {
                e.preventDefault();
                void act(`videos/${id}/cambios`, {
                  texto: new FormData(e.currentTarget).get("texto"),
                });
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
                />
              </label>
              <button className="button" disabled={busy}>
                Enviar cambios
              </button>
            </form>
          )}
          <Recorrido stage={video.stage} />
          <button
            className="text-button danger"
            onClick={async () => {
              if (!window.confirm("¿Borrar este video?")) return;
              try {
                await api(`videos/${id}`, undefined, "DELETE");
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Trash2 size={15} />
            Borrar video
          </button>
        </aside>
      </div>
    </div>
  );
}
