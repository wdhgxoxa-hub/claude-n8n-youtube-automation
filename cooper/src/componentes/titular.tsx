import type { CSSProperties } from "react";

// El texto existe completo desde SSR. CSS revela palabras sin cambiar su geometría.
export function Revelado({
  texto,
  inicio = 0,
}: {
  texto: string;
  inicio?: number;
}) {
  const words = texto.split(" ");
  return words.map((word, i) => (
    <span key={`${word}-${i}`}>
      <span
        className="reveal-word"
        style={{ "--word": Math.min(7, inicio + i) } as CSSProperties}
      >
        {word}
      </span>
      {i < words.length - 1 ? " " : null}
    </span>
  ));
}
