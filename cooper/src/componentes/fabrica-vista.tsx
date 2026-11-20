"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, Clock3 } from "lucide-react";
import { ETAPAS, esperaAprobacion } from "@/lib/etapas";
import type { Video } from "@/db/schema";
import { useEspacio, Empty } from "./espacio";
import { Portada } from "./portada";
import { useMovimientoReducido } from "./movimiento";

export function Recorrido({
  stage,
  compact = false,
}: {
  stage: number;
  compact?: boolean;
}) {
  const reduced = useMovimientoReducido();
  return (
    <motion.ol
      className={`journey ${compact ? "compact" : ""}`}
      aria-label="Etapas del video"
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: reduced ? 0 : 0.025 } },
      }}
    >
      {ETAPAS.map((name, index) => (
        <motion.li
          key={name}
          variants={{ hidden: { opacity: 0.45 }, visible: { opacity: 1 } }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          className={
            index < stage ? "completed" : index === stage ? "current" : "future"
          }
          aria-current={index === stage ? "step" : undefined}
        >
          <span className="stage-node">
            {index < stage ? (
              <Check size={12} />
            ) : (
              String(index + 1).padStart(2, "0")
            )}
          </span>
          <div>
            <span>{name}</span>
            {index === stage && (
              <small>
                {esperaAprobacion(stage)
                  ? "Necesita tu mirada"
                  : stage === 11
                    ? "Listo para el mundo"
                    : "En proceso"}
              </small>
            )}
          </div>
          {index === stage && <span className="stage-live" />}
        </motion.li>
      ))}
    </motion.ol>
  );
}
export function VideoMini({
  video,
  heading = 3,
}: {
  video: Video;
  heading?: 2 | 3;
}) {
  const Title = heading === 2 ? "h2" : "h3";
  const { data } = useEspacio();
  return (
    <Link href={`/videos/${video.id}`} className="video-mini">
      <span className="film-thumbnail">
        <Portada title={video.title} />
      </span>
      <div>
        <small>
          {data.channels.find((c) => c.id === video.channelId)?.name ??
            "Tu canal"}
        </small>
        <Title>{video.title}</Title>
        <span
          className={`video-status ${esperaAprobacion(video.stage) ? "pending" : video.stage === 11 ? "finished" : ""}`}
        >
          {ETAPAS[video.stage]}
        </span>
      </div>
      <ArrowUpRight size={18} />
    </Link>
  );
}
export function FabricaVista() {
  const { data, connected } = useEspacio();
  const [selected, setSelected] = useState("");
  const reduced = useMovimientoReducido();
  const active =
    data.videos.find((v) => v.id === selected) ??
    data.videos.find((v) => v.stage < 11) ??
    data.videos[0];
  const pending = data.videos.filter((v) => esperaAprobacion(v.stage));
  const completed = active?.stage === 11 ? 12 : (active?.stage ?? 0);
  return (
    <section className="factory-pane" aria-label="Fábrica en vivo">
      <div className="section-top">
        <div>
          <h2>La fábrica</h2>
          <p>Cada historia, un paso más cerca.</p>
        </div>
        <span className="live-pill">
          <i />
          {connected ? "En vivo" : "Conectando"}
        </span>
      </div>
      {pending.length > 0 && (
        <Link href={`/videos/${pending[0].id}`} className="approval-alert">
          <Clock3 size={17} />
          <span>
            {pending.length === 1
              ? "Un video espera tu aprobación"
              : `${pending.length} videos esperan tu aprobación`}
          </span>
          <ArrowUpRight size={16} />
        </Link>
      )}
      {active ? (
        <>
          <div className="factory-feature">
            <VideoMini video={active} />
          </div>
          <div className="factory-progress">
            <span>{completed} de 12 etapas completadas</span>
            <strong>{Math.round((completed / 12) * 100)}%</strong>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Recorrido de producción"
            aria-valuemin={0}
            aria-valuemax={12}
            aria-valuenow={completed}
          >
            <motion.div
              initial={false}
              animate={{ scaleX: completed / 12 }}
              transition={{ duration: reduced ? 0 : 0.65, ease: "easeOut" }}
            />
          </div>
          <Recorrido stage={active.stage} compact />
          <Link
            className="text-link factory-link"
            href={`/videos/${active.id}`}
          >
            Abrir detalle del video <ArrowUpRight size={16} />
          </Link>
          {data.videos.length > 1 && (
            <div className="queue">
              <div className="queue-heading">
                <h3>En la mesa de edición</h3>
                <span>{data.videos.length} piezas</span>
              </div>
              <div className="queue-strip">
                {data.videos.map((v) => (
                  <motion.button
                    key={v.id}
                    className="queue-item"
                    aria-pressed={active.id === v.id}
                    aria-label={`Ver recorrido: ${v.title}`}
                    onClick={() => setSelected(v.id)}
                    whileHover={reduced ? {} : { y: -2 }}
                    whileTap={reduced ? {} : { scale: 0.97 }}
                  >
                    <span className="queue-cover">
                      <Portada title={v.title} />
                      <span>{String(v.stage + 1).padStart(2, "0")}</span>
                    </span>
                    <strong>{v.title}</strong>
                    <small>{ETAPAS[v.stage]}</small>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <Empty
            title="Tu primera historia empieza aquí"
            description="Cuéntale a Cooper una idea. Preparará el guion y te pedirá el visto bueno antes de producir."
          >
            <Link className="button secondary" href="/videos">
              Pedir un video
            </Link>
          </Empty>
          <div className="factory-empty-route">
            <span>Un recorrido de 12 etapas</span>
            <p>Investigar, escribir, producir, publicar.</p>
            <div aria-hidden="true">
              {ETAPAS.map((s, i) => (
                <i key={s}>{String(i + 1).padStart(2, "0")}</i>
              ))}
            </div>
            <small>
              Tú decides en la aprobación del guion y en la revisión final.
            </small>
          </div>
        </>
      )}
    </section>
  );
}
