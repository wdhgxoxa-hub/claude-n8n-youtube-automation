"use client";
import { AnimatePresence, m as motion } from "framer-motion";
import Image from "next/image";
import { useRef, useState, useEffect, type FormEvent } from "react";
import { ArrowUp, Paperclip, X, AudioLines, ArrowUpRight } from "lucide-react";
import {
  CooperCara,
  partituraTexto,
  type EstadoCooper,
} from "@/marca/CooperCara";
import { useEspacio, api, Notice } from "./espacio";
import { Indicador, resorte, useMovimientoReducido } from "./movimiento";
import { Revelado } from "./titular";
import { FabricaVista } from "./fabrica-vista";
import { Grabador, subir } from "./grabador";
export function Inicio() {
  const { data, refresh } = useEspacio();
  const reduced = useMovimientoReducido();
  const [tab, setTab] = useState(data.user.home),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [state, setState] = useState<EstadoCooper>("reposo"),
    [files, setFiles] = useState<{ id: string; name: string; mime: string }[]>(
      [],
    ),
    [spoken, setSpoken] = useState(""),
    [transcript, setTranscript] = useState<"simulada" | "real" | null>(null),
    [channel, setChannel] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [historical] = useState(() => new Set(data.messages.map((m) => m.id)));
  useEffect(() => {
    if (state !== "hablando") return;
    const duration = partituraTexto(spoken).reduce(
      (sum, word) => sum + word.duration,
      0,
    );
    const timer = setTimeout(() => setState("reposo"), duration + 150);
    return () => clearTimeout(timer);
  }, [state, spoken]);
  useEffect(() => {
    const list = end.current?.parentElement;
    if (data.messages.length && list) list.scrollTop = list.scrollHeight;
  }, [data.messages.length]);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    setState("pensando");
    try {
      const reply = await api<{ texto: string }>("chat", {
        texto: text,
        adjuntos: files.map((f) => f.id),
        canalId: channel || undefined,
      });
      setText("");
      setFiles([]);
      setTranscript(null);
      await refresh();
      setSpoken(reply.texto);
      setState("hablando");
    } catch (e) {
      setError((e as Error).message);
      setState("reposo");
    } finally {
      setBusy(false);
      textarea.current?.focus();
    }
  }
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
      <div className="home-title">
        <div>
          <motion.h1
            layoutId={reduced ? undefined : "titulo-ruta"}
            transition={{ duration: reduced ? 0 : 0.24 }}
          >
            Hagamos algo bueno.
          </motion.h1>
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
          {tab === "chat" && <Indicador id="vista-inicio" />}
          Chat
        </button>
        <button
          role="tab"
          aria-selected={tab === "fabrica"}
          onClick={() => setTab("fabrica")}
        >
          {tab === "fabrica" && <Indicador id="vista-inicio" />}
          Fábrica {data.videos.length > 0 && `(${data.videos.length})`}
        </button>
      </div>
      <div className={`studio tab-${tab}`}>
        <section className="chat-pane" aria-label="Chat con Cooper">
          <div className="chat-heading">
            <div className="cooper-badge">
              <CooperCara size={56} estado={state} texto={spoken} />
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
            {data.messages.length === 0 ? (
              <div className="chat-welcome">
                <CooperCara estado={state} size={112} texto={spoken} />
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
                  <p>
                    {m.role === "assistant" &&
                    !historical.has(m.id) &&
                    m.content === spoken &&
                    state === "hablando"
                      ? partituraTexto(m.content).map(({ word, delay }, i) => (
                          <motion.span
                            className="response-word"
                            key={i}
                            initial={reduced ? false : { opacity: 0.5 }}
                            animate={{ opacity: 1 }}
                            transition={{
                              delay: reduced ? 0 : delay / 1000,
                              duration: reduced ? 0 : 0.16,
                            }}
                          >
                            {word}
                          </motion.span>
                        ))
                      : m.content}
                  </p>
                  {(JSON.parse(m.attachmentIds) as string[]).map((id, i) => (
                    <a
                      className="attachment-link"
                      key={id}
                      href={`/api/archivos/${id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Paperclip size={14} />
                      Adjunto {i + 1}
                    </a>
                  ))}
                </motion.article>
              ))
            )}
            {busy && (
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
                    disabled={uploading}
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
                    onAudio={(f) => attach(f, true)}
                    onError={setError}
                    onRecording={(v) => setState(v ? "escuchando" : "reposo")}
                  />
                  {data.channels.filter((c) => c.ownerId === data.user.id)
                    .length > 0 && (
                    <select
                      aria-label="Canal del chat"
                      value={channel}
                      onChange={(e) => setChannel(e.target.value)}
                    >
                      <option value="">Último canal</option>
                      {data.channels
                        .filter((c) => c.ownerId === data.user.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
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
