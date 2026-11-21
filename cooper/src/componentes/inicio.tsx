"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRef, useState, useEffect, type FormEvent } from "react";
import { ArrowUp, Paperclip, X, AudioLines, ArrowUpRight } from "lucide-react";
import { CooperCara, type EstadoCooper } from "@/marca/CooperCara";
import { useEspacio, api, Notice } from "./espacio";
import { useMovimientoReducido } from "./movimiento";
import { FabricaVista } from "./fabrica-vista";
import { Grabador, subir } from "./grabador";
import { leerSSE } from "@/lib/stream";
import type { EventoChat, TarjetaChat } from "@/servicios/chat/tipos";
export function Inicio() {
  const { data, refresh } = useEspacio();
  const reduced = useMovimientoReducido();
  const [tab, setTab] = useState(data.user.home),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [state, setState] = useState<EstadoCooper>("reposo"),
    [files, setFiles] = useState<
      { id: string; name: string; image?: boolean }[]
    >([]),
    [transcript, setTranscript] = useState<"simulada" | "real" | null>(null),
    [channel, setChannel] = useState(data.chat.canalId),
    [video, setVideo] = useState(""),
    [partial, setPartial] = useState(""),
    [submitted, setSubmitted] = useState(""),
    [cards, setCards] = useState<TarjetaChat[]>([]);
  const controller = useRef<AbortController | null>(null);
  const mouthTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      if (mouthTimer.current) clearTimeout(mouthTimer.current);
    },
    [],
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const list = end.current?.parentElement;
    if (data.messages.length && list) list.scrollTop = list.scrollHeight;
  }, [data.messages.length, partial, cards.length]);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    setState("pensando");
    try {
      controller.current = new AbortController();
      setSubmitted(text);
      setPartial("");
      setCards([]);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          texto: text,
          adjuntos: files.map((f) => f.id),
          canalId: channel || undefined,
          videoId: video || undefined,
        }),
        signal: controller.current.signal,
      });
      if (!response.ok) throw new Error((await response.json()).error);
      let complete = false;
      for await (const raw of leerSSE(response)) {
        const event = raw as EventoChat;
        if (event.tipo === "error") throw new Error(event.texto);
        if (event.tipo === "tarjeta")
          setCards((old) => [...old, event.tarjeta]);
        if (event.tipo === "texto") {
          setPartial((old) => old + event.texto);
          setState("hablando");
          if (mouthTimer.current) clearTimeout(mouthTimer.current);
          mouthTimer.current = setTimeout(() => setState("pensando"), 450);
        }
        if (event.tipo === "fin") complete = true;
      }
      if (!complete)
        throw new Error(
          "La respuesta se interrumpió. Puedes volver a intentarlo.",
        );
      setText("");
      setFiles([]);
      setTranscript(null);
    } catch (e) {
      setError((e as Error).message);
      setState("reposo");
    } finally {
      if (mouthTimer.current) clearTimeout(mouthTimer.current);
      setState("reposo");
      try {
        await refresh();
      } catch {
        setError("No pudimos actualizar la conversación. Recarga la página.");
      }
      setSubmitted("");
      setPartial("");
      setCards([]);
      setBusy(false);
      textarea.current?.focus();
    }
  }
  async function confirmar(id: string, aceptar: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("chat/confirmar", { id, aceptar });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      await refresh().catch(() =>
        setError("Recarga para ver el resultado de la acción."),
      );
      setBusy(false);
    }
  }
  const canalEfectivo =
    channel ||
    data.chat.canalId ||
    data.channels.find((c) => c.ownerId === data.user.id)?.id ||
    "";
  const tarjetas = [
    ...data.chat.tarjetas,
    ...cards.filter((c) => !data.chat.tarjetas.some((a) => a.id === c.id)),
  ];
  async function attach(file: File, audio = false) {
    setError("");
    setUploading(true);
    try {
      if (files.length >= 5)
        throw new Error("Puedes adjuntar hasta cinco archivos.");
      const uploaded = await subir(file);
      setFiles((old) => [
        ...old,
        { ...uploaded, image: file.type.startsWith("image/") },
      ]);
      if (audio) {
        const result = await api<{ texto: string; simulada: boolean }>(
          "transcribir",
          {
            id: uploaded.id,
          },
        );
        setText(result.texto);
        setTranscript(result.simulada ? "simulada" : "real");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <>
      <div className="home-title">
        <div>
          <h1>Hagamos algo bueno.</h1>
          <p>Tu próxima idea ya tiene equipo.</p>
        </div>
        <span className="date-note">Tu estudio, en marcha</span>
      </div>
      <div className="mobile-tabs" role="tablist" aria-label="Vista de inicio">
        <button
          role="tab"
          aria-selected={tab === "chat"}
          onClick={() => setTab("chat")}
        >
          Chat
        </button>
        <button
          role="tab"
          aria-selected={tab === "fabrica"}
          onClick={() => setTab("fabrica")}
        >
          Fábrica {data.videos.length > 0 && `(${data.videos.length})`}
        </button>
      </div>
      <div className={`studio tab-${tab}`}>
        <section className="chat-pane" aria-label="Chat con Cooper">
          <div className="chat-heading">
            <div className="cooper-badge">
              <CooperCara size={56} estado={state} />
            </div>
            <div>
              <h2>Cooper</h2>
              <p>
                {state === "escuchando"
                  ? "Te escucho…"
                  : state === "pensando"
                    ? "Preparando tu solicitud…"
                    : "De tu lado, de principio a fin."}
              </p>
            </div>
            <span className="chat-online" role="img" aria-label="Disponible" />
          </div>
          <div
            className="conversation"
            role="log"
            aria-label="Conversación con Cooper"
            aria-live="polite"
          >
            {data.messages.length === 0 && !submitted && !partial ? (
              <div className="chat-welcome">
                <CooperCara estado={state} size={112} />
                <h2>
                  Tú pones la idea.
                  <br />
                  Yo pongo todo en marcha.
                </h2>
                <p>
                  Cuéntame qué quieres crear. Te acompaño desde el primer guion
                  hasta la publicación.
                </p>
                <div className="suggestions">
                  {[
                    "Crea un canal: Ciencia cotidiana",
                    "Quiero un video: Por qué el cielo es azul",
                    "¿Qué tengo pendiente?",
                  ].map((s, i) => (
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{
                        duration: reduced ? 0 : 0.22,
                        delay: reduced ? 0 : i * 0.07,
                      }}
                      whileHover={reduced ? {} : { x: 3 }}
                      whileTap={reduced ? {} : { scale: 0.98 }}
                      key={s}
                      onClick={() => {
                        setText(s);
                        textarea.current?.focus();
                      }}
                    >
                      <span>
                        {
                          [
                            data.channels.length
                              ? "Crear otro canal"
                              : "Crear mi primer canal",
                            "Dar forma a una idea",
                            "Revisar mis pendientes",
                          ][i]
                        }
                      </span>
                      <ArrowUpRight size={16} />
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              data.messages.map((m) => (
                <article key={m.id} className={`message ${m.role}`}>
                  <span className="message-author">
                    {m.role === "assistant" ? "Cooper" : data.user.name}
                  </span>
                  <p>{m.content}</p>
                  {(JSON.parse(m.attachmentIds) as string[]).map((id, i) => (
                    <span key={id}>
                      <a
                        className="attachment-link"
                        href={`/api/archivos/${id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Paperclip size={14} />
                        Adjunto {i + 1}
                      </a>
                      {data.chat.fotos.some((f) => f.id === id) && (
                        <Link
                          className="attachment-link"
                          href={`/avatares?foto=${id}`}
                        >
                          Usar foto para mi avatar
                        </Link>
                      )}
                    </span>
                  ))}
                </article>
              ))
            )}
            {submitted &&
              !data.messages.some(
                (m) => m.role === "user" && m.content === submitted,
              ) && (
                <article className="message user">
                  <span className="message-author">{data.user.name}</span>
                  <p>{submitted}</p>
                </article>
              )}
            {partial && (
              <article className="message assistant" aria-busy={busy}>
                <span className="message-author">Cooper</span>
                <p>{partial}</p>
              </article>
            )}
            {tarjetas
              .filter(
                (c) =>
                  c.estado === "pendiente" ||
                  c.estado === "revisar" ||
                  c.estado === "ejecutando",
              )
              .map((c) => (
                <article
                  className="chat-confirmation"
                  key={c.id}
                  aria-label={c.titulo}
                >
                  <h3>{c.titulo}</h3>
                  <p>{c.detalle}</p>
                  {c.estado === "pendiente" ? (
                    <>
                      <p className="helper">
                        Revisa el pedido. Solo se realizará cuando lo confirmes.
                      </p>
                      <div className="button-row">
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() => void confirmar(c.id, true)}
                        >
                          Confirmar
                        </button>
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() => void confirmar(c.id, false)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </>
                  ) : (
                    <p role="status">
                      Revisa el estado de la fábrica antes de repetir esta
                      acción.
                    </p>
                  )}
                </article>
              ))}
            {busy && !partial && (
              <div className="thinking" role="status">
                <span />
                <span />
                <span /> Cooper está pensando
              </div>
            )}
            <div ref={end} />
          </div>
          <div className="composer-area">
            <Notice error={error} />
            {transcript && (
              <p className="helper">
                <AudioLines size={14} />
                {transcript === "simulada"
                  ? "Transcripción simulada."
                  : "Transcripción del audio."}{" "}
                Edita el texto antes de enviarlo.
              </p>
            )}
            <form onSubmit={send} className="composer">
              <label className="sr-only" htmlFor="mensaje">
                Mensaje para Cooper
              </label>
              <textarea
                id="mensaje"
                ref={textarea}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Cuéntame tu idea…"
                maxLength={6000}
                rows={2}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              {files.length > 0 && (
                <div className="file-chips">
                  {files.map((f) => (
                    <span key={f.id}>
                      {f.name}
                      {f.image && (
                        <Link
                          className="attachment-link"
                          href={`/avatares?foto=${f.id}`}
                        >
                          Usar para mi avatar
                        </Link>
                      )}
                      <button
                        type="button"
                        aria-label={`Quitar ${f.name}`}
                        onClick={() =>
                          setFiles(files.filter((x) => x.id !== f.id))
                        }
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="composer-tools">
                <div className="tool-group">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Adjuntar archivo"
                    disabled={uploading || busy}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Paperclip size={19} />
                  </button>
                  <input
                    type="file"
                    aria-label="Archivo adjunto"
                    ref={fileInput}
                    className="sr-only"
                    tabIndex={-1}
                    accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,audio/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) void attach(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                  <Grabador
                    disabled={busy || uploading}
                    onAudio={(f) => attach(f, true)}
                    onError={setError}
                    onRecording={(v) => setState(v ? "escuchando" : "reposo")}
                  />
                  {data.channels.filter((c) => c.ownerId === data.user.id)
                    .length > 0 && (
                    <select
                      aria-label="Canal del chat"
                      value={channel}
                      disabled={busy}
                      onChange={(e) => {
                        setChannel(e.target.value);
                        setVideo("");
                      }}
                    >
                      <option value="">Último canal propio</option>
                      {data.channels
                        .filter((c) => c.ownerId === data.user.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  )}
                  {canalEfectivo &&
                    data.videos.filter(
                      (v) =>
                        v.ownerId === data.user.id &&
                        v.channelId === canalEfectivo,
                    ).length > 0 && (
                      <select
                        aria-label="Video del chat"
                        value={video}
                        disabled={busy}
                        onChange={(e) => setVideo(e.target.value)}
                      >
                        <option value="">Elegir video</option>
                        {data.videos
                          .filter(
                            (v) =>
                              v.ownerId === data.user.id &&
                              v.channelId === canalEfectivo,
                          )
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.title}
                            </option>
                          ))}
                      </select>
                    )}
                </div>
                <button
                  className="send"
                  disabled={busy || uploading || !text.trim()}
                  aria-label="Enviar mensaje"
                >
                  <ArrowUp size={20} />
                </button>
              </div>
            </form>
            <p className="composer-caption">
              {data.chat.simulado ? "Chat de demostración. " : ""}
              {uploading
                ? "Guardando archivo…"
                : "Cooper propone. Tú tienes la última palabra."}
            </p>
          </div>
        </section>
        <FabricaVista />
      </div>
    </>
  );
}
