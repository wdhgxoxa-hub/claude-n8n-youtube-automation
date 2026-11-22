"use client";
import { IlustracionViva } from "./ilustracion-viva";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { animate, m as motion, useMotionValue } from "framer-motion";
import { ArrowUpRight, Check, Clock3 } from "lucide-react";
import { ETAPAS, esperaAprobacion } from "@/lib/etapas";
import type { Estado } from "@/servicios/datos";
type Video = Estado["videos"][number];
import { useEspacio, Empty } from "./espacio";
import { PortadaVideo } from "./portada-video";
import {
  NumeroAnimado,
  TarjetaEdicion,
  useMovimientoReducido,
} from "./movimiento";

function DestelloEtapa({ completed }: { completed: boolean }) {
  const reduced = useMovimientoReducido();
  const previous = useRef(completed);
  const opacity = useMotionValue(0),
    scale = useMotionValue(0.7);
  useEffect(() => {
    const changed = completed && !previous.current;
    previous.current = completed;
    if (!changed || reduced) return;
    const light = animate(opacity, [0, 0.8, 0], { duration: 0.65 });
    const ring = animate(scale, [0.7, 1.55], {
      duration: 0.65,
      ease: "easeOut",
    });
    return () => {
      light.stop();
      ring.stop();
      opacity.set(0);
    };
  }, [completed, reduced, opacity, scale]);
  return (
    <motion.span
      className="stage-spark"
      aria-hidden="true"
      style={{ opacity, scale }}
    />
  );
}

export function Recorrido({
  stage,
  productionState = "activa",
  compact = false,
}: {
  stage: number;
  productionState?: string;
  compact?: boolean;
}) {
  const reduced = useMovimientoReducido();
  return (
    <motion.ol
      className={`journey ${compact ? "compact" : ""}`}
      aria-label="Etapas del video"
      data-production={productionState}
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
          {index < 11 && (
            <span className="stage-connector" aria-hidden="true">
              <motion.span
                initial={false}
                animate={{ scaleY: index < stage || stage === 11 ? 1 : 0 }}
                transition={{ duration: reduced ? 0 : 0.6 }}
              />
            </span>
          )}
          <span className="stage-node">
            {index < stage || stage === 11 ? (
              <Check size={12} />
            ) : (
              String(index + 1).padStart(2, "0")
            )}
            <DestelloEtapa completed={index < stage || stage === 11} />
          </span>
          <div>
            <span>{name}</span>
            {index === stage && (
              <small>
                {productionState === "cancelada"
                  ? "Cancelado"
                  : productionState === "pausada"
                    ? "En pausa"
                    : esperaAprobacion(stage)
                      ? "Necesita tu mirada"
                      : stage === 11
                        ? "Listo para el mundo"
                        : "En proceso"}
              </small>
            )}
          </div>
          {index === stage && productionState === "activa" && (
            <span className="stage-live" />
          )}
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
        <PortadaVideo
          key={video.id}
          videoId={video.id}
          titulo={video.title}
          inicial={video.medios}
        />
      </span>
      <div>
        <small>
          {data.channels.find((c) => c.id === video.channelId)?.name ??
            "Tu canal"}
        </small>
        <Title>{video.title}</Title>
        <span
          className={`video-status ${video.productionState === "activa" && esperaAprobacion(video.stage) ? "pending" : video.stage === 11 ? "finished" : ""}`}
        >
          {video.productionState === "cancelada"
            ? "Cancelado"
            : video.productionState === "pausada"
              ? "En pausa"
              : ETAPAS[video.stage]}
        </span>
      </div>
      <ArrowUpRight size={18} />
    </Link>
  );
}
export function FabricaVista({
  tabPanel = false,
  panelId,
  tabId,
}: {
  tabPanel?: boolean;
  panelId: string;
  tabId: string;
}) {
  const { data, connected } = useEspacio();
  const [selected, setSelected] = useState("");
  const reduced = useMovimientoReducido();
  const active =
    data.videos.find((v) => v.id === selected) ??
    data.videos.find((v) => v.stage < 11) ??
    data.videos[0];
  const pending = data.videos.filter(
    (v) => v.productionState === "activa" && esperaAprobacion(v.stage),
  );
  const completed = active?.stage === 11 ? 12 : (active?.stage ?? 0);
  return (
    <section
      id={panelId}
      className="factory-pane"
      role={tabPanel ? "tabpanel" : undefined}
      aria-label={tabPanel ? undefined : "Fábrica en vivo"}
      aria-labelledby={tabPanel ? tabId : undefined}
      tabIndex={tabPanel ? 0 : undefined}
    >
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
          <div
            className="factory-cinema"
            data-working={
              active.productionState === "activa" &&
              !esperaAprobacion(active.stage) &&
              active.stage < 11
            }
          >
            <IlustracionViva
              nombre="fabrica"
              activo={
                active.productionState === "activa" &&
                !esperaAprobacion(active.stage) &&
                active.stage < 11
              }
            />
            <span>
              {active.stage === 11
                ? "Historia publicada"
                : esperaAprobacion(active.stage)
                  ? "La siguiente escena la decides tú"
                  : "Cada pieza encuentra su lugar"}
            </span>
          </div>
          <div className="factory-feature">
            <VideoMini video={active} />
          </div>
          <div className="factory-progress">
            <span>{completed} de 12 etapas completadas</span>
            <strong>
              <NumeroAnimado value={Math.round((completed / 12) * 100)} />%
            </strong>
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
          <Recorrido
            key={active.id}
            stage={active.stage}
            productionState={active.productionState}
            compact
          />
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
                {data.videos.map((v, i) => (
                  <TarjetaEdicion
                    key={v.id}
                    index={i}
                    selected={active.id === v.id}
                    onClick={() => setSelected(v.id)}
                  >
                    <span className="queue-cover">
                      <PortadaVideo
                        videoId={v.id}
                        titulo={v.title}
                        inicial={v.medios}
                        enCola
                      />
                      <span>{String(v.stage + 1).padStart(2, "0")}</span>
                    </span>
                    <strong>{v.title}</strong>
                    <small>
                      {v.productionState === "cancelada"
                        ? "Cancelado"
                        : v.productionState === "pausada"
                          ? "En pausa"
                          : ETAPAS[v.stage]}
                    </small>
                  </TarjetaEdicion>
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
