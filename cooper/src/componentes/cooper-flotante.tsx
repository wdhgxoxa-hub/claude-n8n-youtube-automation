"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutGroup,
  m as motion,
  useMotionValue,
  animate,
} from "framer-motion";
import { X, Expand, Minimize2 } from "lucide-react";
import { CooperPresencia } from "@/marca/CooperPresencia";
import { useEspacio } from "./espacio";
import { resorte, useMovimientoReducido } from "./movimiento";
import { ChatCooper as Chat } from "./chat-cooper";

export function CooperFlotante({
  abierto,
  cambiar,
  movil,
}: {
  abierto: boolean;
  cambiar: (open: boolean) => void;
  movil: boolean;
}) {
  const { data, marcaContexto: marca } = useEspacio();
  const path = usePathname();
  const reduced = useMovimientoReducido();
  const [completo, setCompleto] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  const dragY = useMotionValue(0);
  useLayoutEffect(() => {
    // Cambiar la preferencia con la hoja abierta no inicia otra proyección.
    panel.current?.removeAttribute("data-projecting");
    opener.current?.removeAttribute("data-projecting");
  }, [reduced]);
  const video = data.videos.find(
    (v) => path === `/videos/${v.id}` && v.ownerId === data.user.id,
  );
  const canal = data.channels.find(
    (c) => c.id === video?.channelId || path === `/canales/${c.id}`,
  );
  const contexto =
    video?.title ||
    canal?.name ||
    marca?.nombre ||
    ({
      "/": "Hoy en el estudio",
      "/videos": "Línea de producción",
      "/publicados": "Tus publicaciones",
      "/aprendizaje": "Lo que aprendimos",
      "/marcas": "Tus marcas",
      "/canales": "Tus canales",
      "/avatares": "Avatares y voces",
      "/perfil": "Tu espacio",
      "/admin": "Tu equipo",
      "/admin/salud": "Salud de la operación",
    }[path] ??
      "Tu estudio");
  const sugerencias = video
    ? [
        "¿En qué etapa está este video?",
        "¿Qué falta por revisar?",
        "Quiero corregir este video",
      ]
    : canal
      ? [
          "¿Qué sigue para este canal?",
          "Quiero una nueva idea",
          "Revisar mis pendientes",
        ]
      : marca
        ? [
            "¿Qué sigue para esta marca?",
            "Quiero preparar una publicación",
            "Revisar el calendario de mi marca",
          ]
        : ((
            {
              "/marcas": [
                "Dar forma a una marca",
                "Preparar una publicación",
                "Revisar mis pendientes",
              ],
              "/publicados": [
                "¿Cómo van mis publicaciones?",
                "¿Qué funcionó mejor?",
                "Preparar el siguiente video",
              ],
              "/aprendizaje": [
                "¿Qué aprendimos esta semana?",
                "¿Qué puedo mejorar?",
                "Dar forma a una idea",
              ],
              "/avatares": [
                "Elegir una voz para mi video",
                "Quiero un presentador",
                "¿Cómo preparo mi avatar?",
              ],
              "/perfil": ["Configurar mis avisos", "¿Qué tengo pendiente?"],
            } as Record<string, string[]>
          )[path] ?? [
            data.channels.some((c) => c.ownerId === data.user.id)
              ? "Crear otro canal"
              : "Crear mi primer canal",
            "Dar forma a una idea",
            "Revisar mis pendientes",
          ]);
  const pendiente = data.videos.some(
    (v) => v.ownerId === data.user.id && [3, 9].includes(v.stage),
  );
  useEffect(() => {
    if (!abierto) return;
    const sheet = panel.current;
    const trigger = opener.current;
    const media = window.matchMedia("(max-width: 1023px)");
    sheet
      ?.querySelector<HTMLButtonElement>('button[aria-label="Cerrar Cooper"]')
      ?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") cambiar(false);
      if (event.key !== "Tab" || !media.matches) return;
      const controls = Array.from(
        sheet?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], textarea, input:not([type="hidden"]), select',
        ) ?? [],
      ).filter((el) => el.getClientRects().length);
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault();
        controls.at(-1)?.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === controls.at(-1)
      ) {
        event.preventDefault();
        controls[0]?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      trigger?.focus();
    };
  }, [abierto, cambiar]);
  return (
    <LayoutGroup id="cooper-flotante" inherit={false}>
      <motion.button
        ref={opener}
        className="cooper-orb"
        aria-label={abierto ? "Cerrar Cooper" : "Abrir Cooper"}
        aria-expanded={abierto}
        aria-controls={abierto ? "cooper-panel" : undefined}
        onClick={() => cambiar(!abierto)}
        layoutId={reduced ? undefined : "cooper-origen"}
        transition={resorte}
        onLayoutAnimationStart={() =>
          opener.current?.setAttribute("data-projecting", "true")
        }
        onLayoutAnimationComplete={() =>
          opener.current?.removeAttribute("data-projecting")
        }
        hidden={abierto}
      >
        <CooperPresencia activo={!abierto} cederAPreview />
        {pendiente && (
          <span className="cooper-tally" aria-label="Tienes algo por revisar" />
        )}
      </motion.button>
      {/* Desmontar al cerrar evita retener controles activos; LayoutGroup conserva la proyección del orbe. */}
      {abierto && (
        <motion.div
          key="cooper"
          ref={panel}
          id="cooper-panel"
          className={`cooper-panel hoja-vidrio ${completo ? "is-full" : ""}`}
          data-projecting={reduced ? undefined : "true"}
          role="dialog"
          style={{ y: dragY }}
          onFocusCapture={(event) => {
            // La hoja completa conserva espacio de escritura al abrir el teclado.
            if (movil && event.target instanceof HTMLTextAreaElement)
              setCompleto(true);
          }}
          aria-modal={movil || undefined}
          aria-label="Cooper, tu compañero"
          layoutId={reduced ? undefined : "cooper-origen"}
          transition={reduced ? { duration: 0.12 } : resorte}
          onLayoutAnimationStart={() =>
            panel.current?.setAttribute("data-projecting", "true")
          }
          onLayoutAnimationComplete={() =>
            panel.current?.removeAttribute("data-projecting")
          }
        >
          <div
            className="cooper-drag"
            onPointerDown={(e) => {
              dragStart.current = e.clientY;
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (dragStart.current === null) return;
              const distance = e.clientY - dragStart.current;
              dragY.set(distance < 0 ? distance * 0.2 : distance);
            }}
            onPointerCancel={() => {
              dragStart.current = null;
              animate(dragY, 0, reduced ? { duration: 0 } : resorte);
            }}
            onPointerUp={(e) => {
              const delta = e.clientY - (dragStart.current ?? e.clientY);
              if (delta < -48) setCompleto(true);
              if (delta > 64) {
                if (completo) setCompleto(false);
                else cambiar(false);
              }
              dragStart.current = null;
              animate(dragY, 0, reduced ? { duration: 0 } : resorte);
            }}
            aria-hidden="true"
          >
            <span />
          </div>
          <div className="cooper-panel-heading">
            <span>
              <strong>Cooper</strong>
              <small>{contexto}</small>
            </span>
            <div>
              <button
                className="icon-button cooper-expand"
                aria-label={completo ? "Reducir Cooper" : "Ampliar Cooper"}
                onClick={() => setCompleto(!completo)}
              >
                {completo ? <Minimize2 size={20} /> : <Expand size={20} />}
              </button>
              <button
                className="icon-button"
                aria-label="Cerrar Cooper"
                onClick={() => cambiar(false)}
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <Chat
            key={video?.id || canal?.id || marca?.id || path}
            canalId={canal?.id}
            videoId={video?.id}
            sugerencias={sugerencias}
            contextoMarca={marca?.nombre}
            alAdjuntar={() => {
              if (movil) setCompleto(true);
            }}
          />
        </motion.div>
      )}
    </LayoutGroup>
  );
}
