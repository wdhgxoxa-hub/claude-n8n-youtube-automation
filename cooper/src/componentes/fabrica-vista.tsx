"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, Clock3 } from "lucide-react";
import { ETAPAS, esperaAprobacion } from "@/lib/etapas";
import type { Video } from "@/db/schema";
import { useEspacio, Empty } from "./espacio";
export function Recorrido({
  stage,
  compact = false,
}: {
  stage: number;
  compact?: boolean;
}) {
  return (
    <ol
      className={`journey ${compact ? "compact" : ""}`}
      aria-label="Etapas del video"
    >
      {ETAPAS.map((name, index) => (
        <li
          key={name}
          className={
            index < stage ? "completed" : index === stage ? "current" : "future"
          }
          aria-current={index === stage ? "step" : undefined}
        >
          <span className="stage-node">
            {index < stage ? (
              <Check size={11} />
            ) : (
              String(index + 1).padStart(2, "0")
            )}
          </span>
          <div>
            <span>{name}</span>
            {index === stage && (
              <motion.small
                key={stage}
                initial={false}
                animate={{ opacity: 1 }}
              >
                {esperaAprobacion(stage)
                  ? "Necesita tu mirada"
                  : stage === 11
                    ? "Listo para el mundo"
                    : "En proceso"}
              </motion.small>
            )}
          </div>
          {index === stage && <span className="stage-live" />}
        </li>
      ))}
    </ol>
  );
}
export function VideoMini({ video }: { video: Video }) {
  const { data } = useEspacio();
  return (
    <Link href={`/videos/${video.id}`} className="video-mini">
      <span className="film-thumbnail">
        <svg viewBox="0 0 72 72" aria-hidden="true">
          <circle cx="36" cy="36" r="22" />
          <ellipse
            cx="36"
            cy="36"
            rx="9"
            ry="28"
            transform="rotate(35 36 36)"
          />
          <path d="M10 36h52M36 10v52" />
        </svg>
      </span>
      <div>
        <small>
          {data.channels.find((c) => c.id === video.channelId)?.name ??
            "Tu canal"}
        </small>
        <h3>{video.title}</h3>
        <span className="muted">{ETAPAS[video.stage]}</span>
      </div>
      <ArrowUpRight size={18} />
    </Link>
  );
}
export function FabricaVista() {
  const { data } = useEspacio();
  const active = data.videos.find((v) => v.stage < 11) ?? data.videos[0];
  const pending = data.videos.filter((v) => esperaAprobacion(v.stage));
  return (
    <section className="factory-pane" aria-label="Fábrica en vivo">
      <div className="section-top">
        <div>
          <h2>La fábrica</h2>
          <p>De una idea a tu próximo video.</p>
        </div>
        <span className="live-pill">
          <i />
          En vivo
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
          <VideoMini video={active} />
          <div className="factory-progress">
            <span>Recorrido de producción</span>
            <span>{active.stage + 1} / 12</span>
          </div>
          <div className="progress-track">
            <motion.div
              animate={{ width: `${((active.stage + 1) / 12) * 100}%` }}
              transition={{ duration: 0.7 }}
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
              <small>También en tu espacio</small>
              {data.videos
                .filter((v) => v.id !== active.id)
                .slice(0, 2)
                .map((v) => (
                  <VideoMini key={v.id} video={v} />
                ))}
            </div>
          )}
        </>
      ) : (
        <Empty
          title="Todo empieza con una idea"
          description="Pide tu primer video en el chat. Aquí verás cada paso de su producción."
        />
      )}
    </section>
  );
}
