"use client";
import { AnimatePresence, m as motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRef, useId, useState, useEffect, type FormEvent } from "react";
import { ArrowUp, Paperclip, X, AudioLines, ArrowUpRight } from "lucide-react";
import { partituraTexto, type EstadoCooper } from "@/marca/CooperCara";
import { useEspacio, api, Notice } from "./espacio";
import { resorte, useMovimientoReducido } from "./movimiento";
import { Revelado } from "./titular";
import { CooperPresencia } from "@/marca/CooperPresencia";
import { Grabador, subir } from "./grabador";
import { leerSSE } from "@/lib/stream";
import type { EventoChat, TarjetaChat } from "@/servicios/chat/tipos";
import { MemoriaChat } from "./memoria";
export function ChatCooper({
  canalId = "",
  videoId = "",
  sugerencias = [],
  contextoMarca,
}: {
  canalId?: string;
  videoId?: string;
  sugerencias?: string[];
  contextoMarca?: string;
}) {
  const instanceId = useId();
  const messageId = `${instanceId}-mensaje`;
  const messageHelpId = `${instanceId}-ayuda-mensaje`;
  const { data, refresh } = useEspacio();
  const reduced = useMovimientoReducido();
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [state, setState] = useState<EstadoCooper>("reposo"),
    [files, setFiles] = useState<{ id: string; name: string; mime: string }[]>(
      [],
    ),
    [transcript, setTranscript] = useState<"simulada" | "real" | null>(null),
    [channel, setChannel] = useState(canalId || data.chat.canalId),
    [video, setVideo] = useState(videoId),
    [partial, setPartial] = useState(""),
    [submitted, setSubmitted] = useState(""),
    [cards, setCards] = useState<TarjetaChat[]>([]);
  const sending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const mouthTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [waiting, setWaiting] = useState(false);
  useEffect(
    () => () => {
      controller.current?.abort();
      if (mouthTimer.current) clearTimeout(mouthTimer.current);
      if (waitingTimer.current) clearTimeout(waitingTimer.current);
    },
    [],
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const focusComposer = useRef(false);
  useEffect(() => {
    if (focusComposer.current && !busy) {
      focusComposer.current = false;
      textarea.current?.focus();
    }
  }, [busy, text]);
  const [historical] = useState(() => new Set(data.messages.map((m) => m.id)));
  useEffect(() => {
    const list = end.current?.parentElement;
    if (data.messages.length && list) list.scrollTop = list.scrollHeight;
  }, [data.messages.length, partial, cards.length]);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending.current || busy || uploading) return;
    sending.current = true;
    setBusy(true);
    setError("");
    setState("pensando");
    setWaiting(false);
    let speech = "";
    if (mouthTimer.current) clearTimeout(mouthTimer.current);
    waitingTimer.current = setTimeout(() => setWaiting(true), 12000);
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
          texto: contextoMarca ? `Sobre mi marca «${contextoMarca}»: ${text}` : text,
          adjuntos: files.map((f) => f.id),
          canalId: channel || undefined,
          videoId: video || undefined,
        }),
        signal: AbortSignal.any([
          controller.current.signal,
          AbortSignal.timeout(90000),
        ]),
      });
      if (!response.ok) {
        const fallback =
          "No pudimos confirmar la respuesta. Revisa las tarjetas pendientes antes de repetir el pedido.";
        let failure: unknown;
        try {
          failure = await response.json();
        } catch {
          throw new Error(fallback);
        }
        throw new Error(
          failure &&
            typeof failure === "object" &&
            "error" in failure &&
            typeof failure.error === "string"
            ? failure.error
            : fallback,
        );
      }
      let complete = false;
      for await (const raw of leerSSE(response)) {
        const event = raw as EventoChat;
        if (event.tipo === "error") throw new Error(event.texto);
        if (event.tipo === "tarjeta")
          setCards((old) => [...old, event.tarjeta]);
        if (event.tipo === "texto") {
          speech += event.texto;
          setWaiting(false);
          if (waitingTimer.current) clearTimeout(waitingTimer.current);
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
      // Los proveedores locales entregan todo el texto junto: la boca continúa tras recibirlo.
      if (speech) {
        setState("hablando");
      }
    } catch (e) {
      setError(
        controller.current?.signal.aborted
          ? "Cancelaste la espera. Revisa las tarjetas pendientes antes de repetir el pedido."
          : e instanceof Error && e.name === "TimeoutError"
            ? "La respuesta tardó demasiado. Revisa las tarjetas pendientes antes de repetir el pedido."
            : e instanceof TypeError
              ? "No pudimos conectar. Tu mensaje sigue aquí; revisa tu conexión antes de enviarlo otra vez."
              : (e as Error).message,
      );
      setState("reposo");
      speech = "";
    } finally {
      if (mouthTimer.current) clearTimeout(mouthTimer.current);
      if (waitingTimer.current) clearTimeout(waitingTimer.current);
      setWaiting(false);
      if (speech)
        mouthTimer.current = setTimeout(
          () => setState("reposo"),
          Math.min(
            6000,
            partituraTexto(speech).reduce((n, p) => n + p.duration, 0),
          ),
        );
      else setState("reposo");
      try {
        await refresh();
      } catch {
        setError("No pudimos actualizar la conversación. Recarga la página.");
      }
      setSubmitted("");
      setPartial("");
      setCards([]);
      sending.current = false;
      focusComposer.current =
        document.activeElement === document.body ||
        !!document.activeElement?.closest(".composer, .chat-confirmation");
      setBusy(false);
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
      focusComposer.current =
        document.activeElement === document.body ||
        !!document.activeElement?.closest(".chat-confirmation");
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
      setFiles((old) => [...old, { ...uploaded, mime: file.type }]);
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
      <MemoriaChat
        recuerdos={data.chat.recuerdos}
        busy={busy}
        refresh={refresh}
        retomar={(canalId, texto) => {
          setChannel(canalId);
          setVideo("");
          setText(texto);
          textarea.current?.focus();
        }}
      />
      {sugerencias.length > 0 && (
        <div
          className="cooper-suggestions"
          aria-label="Sugerencias para esta pantalla"
        >
          {sugerencias.map((sugerencia) => (
            <button
              className="chip"
              key={sugerencia}
              onClick={() => {
                setText(sugerencia);
                textarea.current?.focus();
              }}
            >
              {sugerencia}
            </button>
          ))}
        </div>
      )}
      <section className="chat-pane" aria-label="Chat con Cooper">
        <div className="chat-heading">
          <div className="cooper-badge">
            <CooperPresencia />
          </div>
          <div>
            <h2>Cooper</h2>
            <p role="status" aria-atomic="true">
              {state === "escuchando"
                ? "Te escucho…"
                : busy
                  ? waiting
                    ? "Sigo preparando tu respuesta. Puedes cancelar la espera."
                    : "Preparando tu solicitud…"
                  : "De tu lado, de principio a fin."}
            </p>
          </div>
          <span className="chat-online" role="img" aria-label="Disponible" />
        </div>
        <div
          className="conversation"
          role="log"
          tabIndex={0}
          aria-label="Conversación con Cooper"
          aria-live="polite"
          aria-busy={busy}
        >
          {data.messages.length === 0 && !submitted && !partial ? (
            <div className="chat-welcome">
              <h2>
                <Revelado texto="Tú pones la idea." />
                <br />
                <Revelado texto="Yo pongo todo en marcha." inicio={4} />
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
              <motion.article
                key={m.id}
                className={`message ${m.role}`}
                initial={
                  reduced || historical.has(m.id)
                    ? false
                    : { y: 12, scale: 0.985 }
                }
                animate={{ y: 0, scale: 1 }}
                transition={reduced ? { duration: 0 } : resorte}
              >
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
              </motion.article>
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
              <p>
                {partituraTexto(partial).map(({ word }, i) => (
                  <motion.span
                    className="response-word"
                    key={i}
                    initial={reduced ? false : { opacity: 0.5 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: reduced ? 0 : 0.16 }}
                  >
                    {word}
                  </motion.span>
                ))}
              </p>
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
                    Revisa el estado de la fábrica antes de repetir esta acción.
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
            <label className="sr-only" htmlFor={messageId}>
              Mensaje para Cooper
            </label>
            <textarea
              id={messageId}
              ref={textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cuéntame tu idea…"
              maxLength={6000}
              rows={2}
              aria-describedby={messageHelpId}
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
                <AnimatePresence initial={false}>
                  {files.map((f) => (
                    <motion.span
                      key={f.id}
                      className="attachment-preview"
                      initial={
                        reduced ? false : { opacity: 0, y: 5, scale: 0.96 }
                      }
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
                      transition={{ duration: reduced ? 0 : 0.18 }}
                    >
                      {f.mime.startsWith("image/") ? (
                        <Image
                          unoptimized
                          src={`/api/archivos/${f.id}`}
                          width={44}
                          height={44}
                          alt={`Vista previa de ${f.name}`}
                        />
                      ) : (
                        <Paperclip size={18} aria-hidden="true" />
                      )}
                      <a
                        href={`/api/archivos/${f.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {f.name}
                      </a>
                      {f.mime.startsWith("image/") && (
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
                    </motion.span>
                  ))}
                </AnimatePresence>
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
              {busy && submitted ? (
                <button
                  type="button"
                  className="send"
                  aria-label="Cancelar espera"
                  title="Cancelar espera"
                  onClick={() => controller.current?.abort()}
                >
                  <X size={20} />
                </button>
              ) : (
                <button
                  className="send"
                  disabled={busy || uploading || !text.trim()}
                  aria-label="Enviar mensaje"
                >
                  <ArrowUp size={20} />
                </button>
              )}
            </div>
          </form>
          <p className="composer-caption" role="status">
            {data.chat.simulado ? "Chat de demostración. " : ""}
            {uploading
              ? "Guardando archivo…"
              : "Cooper propone. Tú tienes la última palabra."}
          </p>
          <p className="sr-only" id={messageHelpId}>
            Pulsa Entrar para enviar o Mayús y Entrar para escribir otra línea.
          </p>
        </div>
      </section>
    </>
  );
}
