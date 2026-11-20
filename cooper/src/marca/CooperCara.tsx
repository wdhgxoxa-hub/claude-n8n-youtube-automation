"use client";
import { motion } from "framer-motion";
import { useMovimientoReducido } from "@/componentes/movimiento";
export type EstadoCooper = "reposo" | "escuchando" | "pensando" | "hablando";
export function CooperCara({
  estado = "reposo",
  size = 120,
}: {
  estado?: EstadoCooper;
  size?: number;
}) {
  const reduced = useMovimientoReducido();
  return (
    <motion.svg
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
      transition={{ duration: 0.65, ease: "easeInOut" }}
      whileHover={reduced ? {} : { rotate: -4 }}
    >
      <path
        d="M37 71 27 24q29 1 40 26M143 71l10-47q-29 1-40 26"
        fill="#191c20"
        stroke="#494d52"
        strokeWidth="2"
      />
      <path d="m36 39 9 32 13-16M144 39l-9 32-13-16" fill="#8d5a3b" />
      <path
        d="M39 60q14-21 51-20 37-1 51 20 15 20 11 52-2 30-27 45-15 10-35 10t-35-10q-25-15-27-45-4-32 11-52Z"
        fill="#202329"
        stroke="#4a4c50"
        strokeWidth="2"
      />
      <motion.path
        animate={{ y: !reduced && estado === "escuchando" ? -3 : 0 }}
        transition={{ duration: 0.4 }}
        d="M38 81q13-22 33-13l5 12q-18-8-38 1M142 81q-13-22-33-13l-5 12q18-8 38 1"
        fill="#af784f"
      />
      <path
        d="M35 112q2 29 24 38l13-36-15-9ZM145 112q-2 29-24 38l-13-36 15-9Z"
        fill="#9a6846"
      />
      <motion.g
        animate={
          reduced ? { scaleY: 1 } : { scaleY: [1, 1, 0.06, 1, 1, 0.1, 1, 1] }
        }
        transition={{
          duration: reduced ? 0 : 7,
          repeat: reduced ? 0 : Infinity,
          times: [0, 0.53, 0.55, 0.57, 0.6, 0.62, 0.64, 1],
        }}
        style={{ transformOrigin: "90px 92px" }}
      >
        <path
          d="M45 91q15-14 30 1-17 14-30-1M105 92q15-15 30-1-13 15-30 1"
          fill="#e5e6d9"
        />
        <motion.g
          animate={
            reduced
              ? { x: 0, y: 0 }
              : estado === "pensando"
                ? { x: 2, y: -2 }
                : estado === "escuchando"
                  ? { x: -1, y: 0 }
                  : { x: [0, 0, 2, 2, 0], y: [0, 0, -1, -1, 0] }
          }
          transition={{
            duration: reduced ? 0 : estado === "reposo" ? 9 : 0.45,
            repeat: !reduced && estado === "reposo" ? Infinity : 0,
          }}
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
        d="M71 138q19 12 38 0"
        fill="#17191d"
        stroke="#17191d"
        strokeWidth="3"
        strokeLinecap="round"
        animate={{
          d:
            !reduced && estado === "hablando"
              ? [
                  "M71 138q19 12 38 0",
                  "M74 136q16 29 32 0",
                  "M71 138q19 8 38 0",
                  "M76 136q14 22 28 0",
                  "M71 138q19 12 38 0",
                ]
              : "M71 138q19 12 38 0",
        }}
        transition={{
          repeat: !reduced && estado === "hablando" ? Infinity : 0,
          duration: reduced ? 0 : 0.75,
        }}
        style={{ transformOrigin: "90px 138px" }}
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
