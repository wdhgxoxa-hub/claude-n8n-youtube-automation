"use client";
import { useState } from "react";
import Image from "next/image";
import {
  enlaceIncrustado,
  type Observabilidad,
} from "@/contratos/observabilidad";
export function MediosVideo({
  datos,
  titulo,
}: {
  datos: Observabilidad;
  titulo: string;
}) {
  const [fallo, setFallo] = useState(false);
  return (
    <>
      {datos.montaje && (
        <section className="real-player" aria-label="Video terminado">
          <video
            key={datos.montaje}
            controls
            playsInline
            preload="metadata"
            poster={datos.miniatura || undefined}
            src={datos.montaje}
            onError={() => setFallo(true)}
            onLoadedData={() => setFallo(false)}
            aria-label={`Video terminado: ${titulo}`}
          />
          <div className="player-caption">
            <strong>Video terminado</strong>
            <a href={datos.montaje} target="_blank" rel="noreferrer">
              Abrir video
            </a>
          </div>
          {fallo && (
            <p role="status">
              No se pudo cargar el video. Prueba el enlace o vuelve a intentarlo
              más tarde.
            </p>
          )}
        </section>
      )}
      {datos.escenas.length > 0 && (
        <section className="scene-gallery" aria-label="Piezas por escena">
          <h2>Piezas por escena</h2>
          <div className="scene-grid">
            {[...datos.escenas]
              .sort((a, b) => a.orden - b.orden)
              .map((e) => (
                <article key={e.id}>
                  <h3>Escena {e.orden + 1}</h3>
                  {e.imagen && (
                    <a href={e.imagen} target="_blank" rel="noreferrer">
                      <Image
                        src={e.imagen}
                        alt={`Imagen de la escena ${e.orden + 1}`}
                        width={480}
                        height={270}
                        unoptimized
                      />
                    </a>
                  )}
                  {e.clip && (
                    <video
                      controls
                      playsInline
                      preload="none"
                      src={e.clip}
                      aria-label={`Clip de la escena ${e.orden + 1}`}
                    />
                  )}
                  {e.voz && (
                    <audio
                      controls
                      preload="none"
                      src={e.voz}
                      aria-label={`Voz de la escena ${e.orden + 1}`}
                    />
                  )}
                </article>
              ))}
          </div>
        </section>
      )}
      {datos.publicaciones.length > 0 && (
        <section className="published-players" aria-label="Videos publicados">
          <h2>En las redes</h2>
          {datos.publicaciones.map((p) => {
            const embed = enlaceIncrustado(p.url);
            return (
              <article key={p.id}>
                <h3>{p.red}</h3>
                {embed && (
                  <iframe
                    src={embed}
                    title={`${titulo} en ${p.red}`}
                    loading="lazy"
                    allow="fullscreen; encrypted-media; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                )}
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer">
                    Ver publicación en {p.red}
                  </a>
                ) : (
                  <p>Enlace todavía no disponible.</p>
                )}
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
