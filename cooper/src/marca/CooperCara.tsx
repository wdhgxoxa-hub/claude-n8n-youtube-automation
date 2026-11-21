"use client";
import { useEffect, useRef } from "react";
import { animate, motion, useInView, useMotionValue } from "framer-motion";
import { useMovimientoReducido } from "@/componentes/movimiento";
export type EstadoCooper = "reposo" | "escuchando" | "pensando" | "hablando";
export function CooperCara({
  estado = "reposo",
  size = 120,
  texto = "",
}: {
  estado?: EstadoCooper;
  size?: number;
  texto?: string;
}) {
  const reduced = useMovimientoReducido();
  const face = useRef<SVGSVGElement>(null);
  const visible = useInView(face);
  const blink = useMotionValue(1),
    gazeX = useMotionValue(0),
    gazeY = useMotionValue(0),
    mouth = useMotionValue(1);
  useEffect(() => {
    if (reduced || !visible) return;
    let timer: ReturnType<typeof setTimeout>;
    let blinkAnimation: ReturnType<typeof animate> | undefined;
    const schedule = () => {
      timer = setTimeout(
        () => {
          blinkAnimation = animate(blink, [1, 0.08, 1], { duration: 0.18 });
          schedule();
        },
        3000 + Math.random() * 4000,
      );
    };
    const visibility = () => {
      clearTimeout(timer);
      blinkAnimation?.stop();
      blink.set(1);
      if (!document.hidden) schedule();
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearTimeout(timer);
      blinkAnimation?.stop();
      blink.set(1);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [reduced, visible, blink]);
  useEffect(() => {
    if (reduced || !visible) return;
    let frame = 0;
    const follow = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || document.hidden) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = face.current?.getBoundingClientRect();
        if (!rect) return;
        gazeX.set(
          Math.max(
            -3,
            Math.min(3, (event.clientX - rect.x - rect.width / 2) / 100),
          ),
        );
        gazeY.set(
          Math.max(
            -2,
            Math.min(2, (event.clientY - rect.y - rect.height / 2) / 100),
          ),
        );
      });
    };
    const rest = () => {
      cancelAnimationFrame(frame);
      gazeX.set(0);
      gazeY.set(0);
    };
    window.addEventListener("pointermove", follow, { passive: true });
    document.documentElement.addEventListener("pointerleave", rest);
    return () => {
      rest();
      window.removeEventListener("pointermove", follow);
      document.documentElement.removeEventListener("pointerleave", rest);
    };
  }, [reduced, visible, gazeX, gazeY]);
  useEffect(() => {
    if (reduced || !visible || estado !== "hablando" || !texto) return;
    // La misma cadencia por palabra controla la respuesta y la boca; puntuación = pausa.
    let timer: ReturnType<typeof setTimeout>;
    let animation: ReturnType<typeof animate> | undefined;
    const words = partituraTexto(texto);
    let index = 0;
    const speak = () => {
      if (document.hidden || index >= words.length) {
        mouth.set(1);
        return;
      }
      const { word, duration } = words[index++];
      animation = animate(mouth, [1, 1.3 + Math.min(word.length, 8) / 10, 1], {
        duration: (duration / 1000) * 0.75,
      });
      timer = setTimeout(speak, duration);
    };
    speak();
    return () => {
      clearTimeout(timer);
      animation?.stop();
      mouth.set(1);
    };
  }, [reduced, visible, estado, texto, mouth]);
  return (
    <motion.svg
      ref={face}
      data-cooper-state={estado}
      width={size}
      height={size}
      viewBox="0 0 180 180"
      role="img"
      aria-label={`Cooper ${estado}`}
      animate={
        reduced
          ? { rotate: 0, y: 0 }
          : {
              rotate:
                estado === "escuchando" ? -6 : estado === "pensando" ? 3 : 0,
              y: estado === "hablando" ? [0, -2, 0] : 0,
            }
      }
      transition={{ duration: reduced ? 0 : 0.65, ease: "easeInOut" }}
      whileHover={reduced ? {} : { rotate: -4 }}
    >
      <motion.g
        className="cooper-ear"
        animate={{ rotate: !reduced && estado === "escuchando" ? -8 : 0 }}
        transition={{ duration: reduced ? 0 : 0.35 }}
        style={{ transformOrigin: "49px 65px" }}
      >
        <path
          d="M37 71 27 24q29 1 40 26"
          fill="#191c20"
          stroke="#494d52"
          strokeWidth="2"
        />
        <path d="m36 39 9 32 13-16" fill="#8d5a3b" />
      </motion.g>
      <motion.g
        className="cooper-ear"
        animate={{ rotate: !reduced && estado === "escuchando" ? 6 : 0 }}
        transition={{ duration: reduced ? 0 : 0.4 }}
        style={{ transformOrigin: "131px 65px" }}
      >
        <path
          d="M143 71l10-47q-29 1-40 26"
          fill="#191c20"
          stroke="#494d52"
          strokeWidth="2"
        />
        <path d="M144 39l-9 32-13-16" fill="#8d5a3b" />
      </motion.g>
      <path
        d="M39 60q14-21 51-20 37-1 51 20 15 20 11 52-2 30-27 45-15 10-35 10t-35-10q-25-15-27-45-4-32 11-52Z"
        fill="#202329"
        stroke="#4a4c50"
        strokeWidth="2"
      />
      <motion.path
        animate={{ y: !reduced && estado === "escuchando" ? -3 : 0 }}
        transition={{ duration: reduced ? 0 : 0.4 }}
        d="M38 81q13-22 33-13l5 12q-18-8-38 1M142 81q-13-22-33-13l-5 12q18-8 38 1"
        fill="#af784f"
      />
      <path
        d="M35 112q2 29 24 38l13-36-15-9ZM145 112q-2 29-24 38l-13-36 15-9Z"
        fill="#9a6846"
      />
      <motion.g
        className="cooper-eyes"
        style={{ scaleY: reduced ? 1 : blink, transformOrigin: "90px 92px" }}
      >
        <path
          d="M45 91q15-14 30 1-17 14-30-1M105 92q15-15 30-1-13 15-30 1"
          fill="#e5e6d9"
        />
        <motion.g
          className="cooper-gaze"
          style={{ x: reduced ? 0 : gazeX, y: reduced ? 0 : gazeY }}
        >
          <circle cx="61" cy="92" r="8" fill="#83c8e4" />
          <circle cx="119" cy="92" r="8" fill="#82966b" />
          <path d="M119 84a8 8 0 0 1 0 16Z" fill="#8d603d" />
          <circle cx="61" cy="92" r="4" fill="#11161a" />
          <circle cx="119" cy="92" r="4" fill="#11161a" />
          <circle cx="59" cy="89" r="2" fill="white" />
          <circle cx="117" cy="89" r="2" fill="white" />
        </motion.g>
      </motion.g>
      <path
        d="M65 109q25-16 50 0l13 19q-1 23-38 24-37-1-38-24Z"
        fill="#b17f5c"
      />
      <path d="M74 113q16-7 32 0l-4 11q-12 9-24 0Z" fill="#111418" />
      <path
        d="M78 115q12-4 23 0"
        stroke="#595b60"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <motion.path
        className="cooper-mouth"
        d="M71 138q19 12 38 0"
        fill="#17191d"
        stroke="#17191d"
        strokeWidth="3"
        strokeLinecap="round"
        style={{ scaleY: reduced ? 1 : mouth, transformOrigin: "90px 138px" }}
      />
      <path
        d="M90 128v9M62 126l1 0m8 3h1m45-3h1m-10 3h1"
        stroke="#654631"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </motion.svg>
  );
}

export function duracionPalabra(word: string) {
  return (
    Math.min(320, 110 + word.length * 18) + (/[.,;:!?]$/.test(word) ? 160 : 0)
  );
}

export function partituraTexto(text: string) {
  const words = text.match(/\S+\s*/g) ?? [];
  const total = words.reduce(
    (sum, word) => sum + duracionPalabra(word.trim()),
    0,
  );
  const speed = Math.min(1, 8000 / total);
  let delay = 0;
  return words.map((word) => {
    const duration = duracionPalabra(word.trim()) * speed;
    const item = { word, duration, delay };
    delay += duration;
    return item;
  });
}
