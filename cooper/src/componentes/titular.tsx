import type { CSSProperties } from "react";

// El texto existe completo desde SSR. CSS revela palabras sin cambiar su geometría.
export function Revelado({ texto }: { texto: string }) {
  return texto.split(" ").map((word, i) => (
    <span key={`${word}-${i}`}>
      <span className="reveal-word" style={{ "--word": i } as CSSProperties}>
        {word}
      </span>
      {i < texto.split(" ").length - 1 ? " " : null}
    </span>
  ));
}
