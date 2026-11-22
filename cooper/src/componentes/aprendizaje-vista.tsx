"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import type { Leccion, Medicion } from "@/contratos/observabilidad";
import {
  filtrarResultados,
  type AprendizajeResultado,
  type PublicacionResultado,
  type Resultados,
} from "@/contratos/resultados";
import { useEspacio } from "./espacio";
import { InterruptorAprendizaje } from "./control-aprendizaje";
import { Cifra, Chip, Medio } from "./primitivas";
import { useVideoMedios } from "./portada-video";
import { fecha, numero } from "./metricas-resultados";
import { Filtros, Origen, useResultados } from "./resultados";
import { nombreMedio } from "./transiciones";
import styles from "./aprendizaje-vista.module.css";

const metricas = {
  vistas: "Vistas",
  meGusta: "Me gusta",
  comentarios: "Comentarios",
  retencion: "Retención",
  seguidoresGanados: "Seguidores ganados",
};
type Evidencia = NonNullable<Leccion["origenes"]>[number];
type LeccionVideo = Extract<AprendizajeResultado, { tipo: "video" }>;

function valorEvidencia(origen: Evidencia) {
  return origen.metrica === "retencion"
    ? Math.round(origen.valor * 100)
    : origen.valor;
}

function valorComparable(medicion: Medicion, origen: Evidencia) {
  if (origen.segundo !== undefined) {
    return origen.metrica === "retencion"
      ? medicion.curvaRetencion?.find((p) => p.segundo === origen.segundo)
          ?.porcentaje
      : undefined;
  }
  return medicion[origen.metrica];
}

function publicacionVideo(
  resultado: Resultados,
  videoId: string,
  ambitoId: string,
  red?: string,
) {
  return resultado.publicaciones.find(
    (p): p is Extract<PublicacionResultado, { tipo: "video" }> =>
      p.tipo === "video" &&
      p.ambitoId === ambitoId &&
      (!red || p.publicacion.red.toLowerCase() === red.toLowerCase()) &&
      (p.videoId === videoId ||
        p.href === `/videos/${encodeURIComponent(videoId)}`),
  );
}

function VideoOrigen({
  origen,
  resultado,
  ambitoId,
}: {
  origen: Evidencia;
  resultado: Resultados;
  ambitoId: string;
}) {
  const { data } = useEspacio();
  const video = data.videos.find((v) => v.id === origen.videoId);
  const publicacion = publicacionVideo(
    resultado,
    origen.videoId,
    ambitoId,
    origen.red,
  );
  const medio = useVideoMedios({
    videoId: origen.videoId,
    inicial: publicacion?.medios ?? video?.medios,
    publicacion: publicacion?.publicacion.id,
  });
  const titulo = video?.title ?? publicacion?.titulo ?? "Video de origen";
  return (
    <div className={styles.origen}>
      <Link
        href={`/videos/${encodeURIComponent(origen.videoId)}`}
        className={styles.enlaceMedio}
        aria-label={`Ver video: ${titulo}`}
      >
        <div
          data-video-transition={nombreMedio(origen.videoId)}
          aria-hidden="true"
        >
          <Medio
            poster={medio?.poster?.url}
            preview={medio?.preview?.url}
            alt={medio?.poster ? titulo : "Portada todavía no disponible"}
            videoId={origen.videoId}
            tinte={medio?.tinte}
            proporcion={
              (medio?.relacionAspecto ?? 16 / 9) < 1 ? "vertical" : "horizontal"
            }
            className={styles.miniatura}
          />
        </div>
      </Link>
      <div className={styles.origenTexto}>
        <span className={styles.paso}>01 / El video</span>
        <p className={styles.tituloVideo}>{titulo}</p>
        <p className={styles.meta}>
          {origen.red} · {origen.ventana} · {fecha(origen.fecha)}
        </p>
      </div>
    </div>
  );
}

function EfectoSiguiente({
  registro,
  resultado,
}: {
  registro: LeccionVideo;
  resultado: Resultados;
}) {
  const l = registro.leccion;
  const origen = l.origenes?.[0];
  const aplicacion = l.aplicaciones?.find(
    (a) => !l.origenes?.some((o) => o.videoId === a.videoId),
  );
  // Una comparación solo es legible entre la misma red, métrica y ventana.
  // Aplicación en un guion no prueba que ese cambio haya causado el resultado.
  const siguiente =
    aplicacion && origen
      ? resultado.publicaciones.find(
          (p): p is Extract<PublicacionResultado, { tipo: "video" }> =>
            p.tipo === "video" &&
            p.ambitoId === registro.ambitoId &&
            Date.parse(p.fecha ?? "") >= Date.parse(l.fecha) &&
            (p.videoId === aplicacion.videoId ||
              p.href === `/videos/${encodeURIComponent(aplicacion.videoId)}`) &&
            p.publicacion.red.toLowerCase() === origen.red.toLowerCase(),
        )
      : undefined;
  const medicion = origen
    ? siguiente?.publicacion.historial
        .filter(
          (m) =>
            m.ventana === origen.ventana &&
            valorComparable(m, origen) != null &&
            Date.parse(m.fecha) >= Date.parse(l.fecha),
        )
        .sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha))
        .at(-1)
    : undefined;
  const valor = origen && medicion ? valorComparable(medicion, origen) : null;
  return (
    <div className={styles.efecto}>
      <span className={styles.paso}>05 / El siguiente video</span>
      {origen && siguiente && valor != null ? (
        <>
          <Cifra
            valor={
              origen.metrica === "retencion" ? Math.round(valor * 100) : valor
            }
            etiqueta={`${metricas[origen.metrica]}${origen.metrica === "retencion" ? " (%)" : ""}`}
            variacion={`Antes: ${numero(valorEvidencia(origen))}${origen.metrica === "retencion" ? " %" : ""} · ${origen.ventana}${origen.segundo !== undefined ? ` · segundo ${numero(origen.segundo)}` : ""}`}
            className={styles.cifraEfecto}
          />
          <Link className={styles.enlace} href={siguiente.href}>
            <span>{siguiente.titulo}</span>
            <span aria-hidden="true">↗</span>
          </Link>
          <p className={styles.meta}>
            Resultado observado. Todavía no demuestra que el cambio sea la
            causa.
          </p>
        </>
      ) : (
        <>
          <p className={styles.espera}>Esperando el siguiente resultado</p>
          <p className={styles.meta}>
            {l.aplicaciones?.length
              ? "Aplicada en guiones; el efecto aún necesita nuevas métricas."
              : "Primero aplicamos el cambio. Después comparamos la misma red y el mismo periodo."}
          </p>
        </>
      )}
    </div>
  );
}

function LeccionEnTiempo({
  registro,
  resultado,
  indice,
}: {
  registro: LeccionVideo;
  resultado: Resultados;
  indice: number;
}) {
  const { data } = useEspacio();
  const l = registro.leccion;
  const origen = l.origenes?.[0];
  return (
    <li className={styles.hito}>
      <span className={styles.numero} aria-hidden="true">
        {String(indice + 1).padStart(2, "0")}
      </span>
      <article
        className={`lesson ${styles.leccion}${indice < 8 ? " entrada-estudio" : ""}`}
        style={{ "--orden": Math.min(indice, 7) } as CSSProperties}
      >
        <header className={styles.cabeceraLeccion}>
          <div className={styles.metaLinea}>
            <time dateTime={registro.fecha ?? undefined}>
              {fecha(registro.fecha)}
            </time>
            <span className={styles.etiqueta}>
              {l.nivel === "patron"
                ? "Patrón por contrastar"
                : l.origenes?.length
                  ? "Hipótesis"
                  : "Apunte anterior"}
            </span>
          </div>
          <h2>{registro.titulo}</h2>
          <Origen
            ambito={resultado.ambitos.find((a) => a.id === registro.ambitoId)!}
            simulada={registro.simulada}
          />
        </header>
        <div className={styles.recorrido}>
          {origen ? (
            <VideoOrigen
              origen={origen}
              resultado={resultado}
              ambitoId={registro.ambitoId}
            />
          ) : (
            <div className={styles.sinOrigen}>
              <span className={styles.paso}>01 / El video</span>
              <p>No hay un video enlazado a este apunte.</p>
              <Link className={styles.enlace} href={registro.href}>
                Ver el canal ↗
              </Link>
            </div>
          )}
          <div className={styles.razonamiento}>
            <div className={styles.senal}>
              <span className={styles.paso}>02 / La señal</span>
              <Cifra
                valor={origen ? valorEvidencia(origen) : null}
                etiqueta={
                  origen
                    ? `${metricas[origen.metrica]}${origen.metrica === "retencion" ? " (%)" : ""}`
                    : "Sin cifra enlazada"
                }
                variacion={
                  origen?.segundo !== undefined
                    ? `En el segundo ${numero(origen.segundo)}`
                    : origen?.ventana
                }
                heroe
                className={styles.cifraSenal}
              />
            </div>
            <div className={styles.causa}>
              <span className={styles.paso}>03 / Posible causa:</span>
              <p>
                {l.causa ||
                  "La causa todavía no se ha contrastado con los datos."}
              </p>
              <p className={styles.meta}>
                {l.nivel === "patron"
                  ? "Se repite en tres o más videos. La causa sigue por contrastar."
                  : "Una pista para probar, todavía no una conclusión."}
              </p>
            </div>
            <div className={styles.correccion}>
              <span className={styles.paso}>
                04 /{" "}
                {l.aplicaciones?.length
                  ? "Cambio aplicado"
                  : "Cambio propuesto:"}
              </span>
              <p>
                {l.correccion || "Aún no se ha propuesto un cambio concreto."}
              </p>
              {!!l.aplicaciones?.length && (
                <ul
                  className={styles.aplicaciones}
                  aria-label="Aplicaciones de la lección"
                >
                  {l.aplicaciones.map((a, i) => (
                    <li key={a.videoId + i}>
                      <Link
                        className={styles.enlace}
                        href={`/videos/${encodeURIComponent(a.videoId)}`}
                      >
                        Ver guion ↗
                      </Link>
                      <span>{a.cambio}</span>
                    </li>
                  ))}
                </ul>
              )}
              {!l.aplicaciones?.length && (
                <p className={styles.meta}>
                  Pendiente de aplicar en el siguiente guion.
                </p>
              )}
            </div>
            <EfectoSiguiente registro={registro} resultado={resultado} />
          </div>
        </div>
        <details className={styles.detalles}>
          <summary>Ver las mediciones y el contexto</summary>
          {!!l.aplicaciones?.length && (
            <p className={styles.meta}>
              La fecha del cambio aún no está disponible.
            </p>
          )}
          {!l.origenes?.length && (
            <p className={styles.meta}>
              Este apunte no tiene mediciones enlazadas; no se aplica
              automáticamente al guion.
            </p>
          )}
          {!!l.origenes?.length && (
            <ul
              className={styles.evidencia}
              aria-label="Evidencia de la lección"
            >
              {l.origenes.map((o, i) => (
                <li key={o.videoId + o.red + i}>
                  <Link href={`/videos/${encodeURIComponent(o.videoId)}`}>
                    {data.videos.find((v) => v.id === o.videoId)?.title ||
                      publicacionVideo(resultado, o.videoId, registro.ambitoId)
                        ?.titulo ||
                      "Video de origen"}
                  </Link>
                  {` · ${o.red} · ${o.ventana} · ${metricas[o.metrica]}: ${numero(valorEvidencia(o))}${o.metrica === "retencion" ? " %" : ""}`}
                  {o.segundo !== undefined &&
                    ` en el segundo ${numero(o.segundo)}`}
                  {o.demoraHoras > 0 &&
                    ` (captura ${o.demoraHoras} h después del hito)`}
                </li>
              ))}
            </ul>
          )}
          {!!l.ganchos.length && (
            <p>
              <strong>Ideas para abrir:</strong> {l.ganchos.join(" · ")}
            </p>
          )}
          {!!l.temas.length && (
            <p>
              <strong>Temas para explorar:</strong> {l.temas.join(" · ")}
            </p>
          )}
        </details>
      </article>
    </li>
  );
}

function EjemploVacio({ filtrado }: { filtrado: boolean }) {
  return (
    <section className={styles.vacio} aria-label="Cómo aparece una lección">
      <p className={styles.paso}>Cada video deja una pista</p>
      <h2>El próximo puede empezar mejor.</h2>
      {filtrado && <p>No hay aprendizajes para estos filtros.</p>}
      <p>
        Cuando lleguen las primeras mediciones, verás aquí qué pasó, qué
        cambiamos y cómo respondió el siguiente video.
      </p>
      <div className={styles.ejemplo}>
        <span className={styles.etiqueta}>
          Ejemplo ficticio · así se lee una lección
        </span>
        <ol>
          <li>
            <span>El video</span>
            <strong>Una pregunta sobre el mar</strong>
          </li>
          <li>
            <span>La señal</span>
            <strong>40 % sigue mirando a los 3 s</strong>
          </li>
          <li>
            <span>La causa posible</span>
            <strong>La explicación tarda en llegar</strong>
          </li>
          <li>
            <span>El cambio</span>
            <strong>Abrir con la respuesta</strong>
          </li>
          <li>
            <span>El siguiente</span>
            <strong>Medir antes de sacar conclusiones</strong>
          </li>
        </ol>
      </div>
      <Link className="button secondary" href="/publicados">
        Ver mis publicaciones
      </Link>
    </section>
  );
}

export function Aprendizaje({ initial }: { initial: Resultados }) {
  const { data } = useEspacio();
  const consulta = useResultados(initial);
  const { resultado, filtro, error } = consulta;
  const [estado, setEstado] = useState("todos");
  const lecciones = filtrarResultados(
    resultado.aprendizajes,
    resultado.ambitos,
    filtro,
  );
  const videos = lecciones.filter((l): l is LeccionVideo => l.tipo === "video");
  const marcas = lecciones.filter((l) => l.tipo === "marca");
  const fallos = filtrarResultados(
    resultado.incidencias,
    resultado.ambitos,
    filtro,
  );
  const visibles = fallos.filter(
    (f) => estado === "todos" || f.incidencia.estado === estado,
  );
  return (
    <div className={`page ${styles.pagina}`}>
      <header className={styles.cabecera}>
        <div>
          <h1>Lo que aprendimos</h1>
          <p className={styles.introduccion}>
            Una señal. Un cambio. Un siguiente intento.
          </p>
        </div>
        {data.user.role === "admin" && <InterruptorAprendizaje />}
      </header>
      {data.demo && (
        <p className={styles.avisoDemo}>
          Ejemplos de aprendizaje con datos ficticios.
        </p>
      )}
      <Filtros {...consulta} />
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <div className={styles.resumen}>
        <p role="status">
          {videos.length} {videos.length === 1 ? "lección" : "lecciones"} ·{" "}
          {marcas.length} de marcas
        </p>
        <Link
          className={styles.enlace}
          href="/marcas?seccion=aprendizaje"
          aria-label="Aprendizaje de marcas"
        >
          Marcas <span aria-hidden="true">↗</span>
        </Link>
      </div>
      {videos.length ? (
        <ol
          className={styles.timeline}
          aria-label="Línea de tiempo del aprendizaje"
        >
          {videos.map((l, i) => (
            <LeccionEnTiempo
              key={l.id}
              registro={l}
              resultado={resultado}
              indice={i}
            />
          ))}
        </ol>
      ) : (
        <EjemploVacio filtrado={Object.values(filtro).some(Boolean)} />
      )}
      {!!marcas.length && (
        <section
          className={styles.seccion}
          aria-labelledby="observaciones-marcas"
        >
          <div className={styles.tituloSeccion}>
            <div>
              <p className={styles.paso}>Otra mirada</p>
              <h2 id="observaciones-marcas">Lo que cuentan tus marcas</h2>
            </div>
            <Link className={styles.enlace} href="/marcas?seccion=aprendizaje">
              Ver las marcas ↗
            </Link>
          </div>
          {marcas.map((l) => (
            <article className={`lesson ${styles.observacion}`} key={l.id}>
              <div>
                <p className={styles.meta}>
                  {fecha(l.fecha)} · {l.redes.join(" · ") || "Todas las redes"}
                </p>
                <h3>{l.titulo}</h3>
                <Origen
                  ambito={resultado.ambitos.find((a) => a.id === l.ambitoId)!}
                  simulada={l.simulada}
                />
              </div>
              <div className={styles.textoObservacion}>
                <p className={styles.meta}>
                  {l.clase === "estudio"
                    ? "Estudio descriptivo; todavía no es una lección comprobada."
                    : "Una observación de esta pieza; todavía no es una lección comprobada."}
                </p>
                <p>{l.resumen}</p>
                {l.aviso && <p>{l.aviso}</p>}
                {l.clase === "resultado" && (
                  <div className={styles.cifrasMarca}>
                    <Cifra
                      valor={l.metricas?.vistas ?? null}
                      etiqueta="Vistas"
                    />
                    <Cifra
                      valor={l.metricas?.alcance ?? null}
                      etiqueta="Alcance"
                    />
                    <Cifra
                      valor={l.metricas?.interacciones ?? null}
                      etiqueta="Interacciones"
                    />
                  </div>
                )}
                <Link className={styles.enlace} href={l.href}>
                  Ver la pieza y su contexto ↗
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
      <section className={styles.seccion} aria-labelledby="correcciones-videos">
        <div className={styles.tituloSeccion}>
          <div>
            <p className={styles.paso}>Durante el camino</p>
            <h2 id="correcciones-videos">Fallos y correcciones de videos</h2>
          </div>
          <div
            className={styles.chips}
            role="group"
            aria-label="Filtrar fallos"
          >
            {["todos", "pendiente", "corregido"].map((f) => (
              <Chip key={f} activo={estado === f} onClick={() => setEstado(f)}>
                {f === "todos"
                  ? "Todos"
                  : f === "pendiente"
                    ? "Pendientes"
                    : "Corregidos"}
              </Chip>
            ))}
          </div>
        </div>
        {visibles.map((r) => (
          <article className={styles.incidente} key={r.id}>
            <div>
              <p className={styles.meta}>
                {fecha(r.fecha)} ·{" "}
                {
                  {
                    ejecucion: "Producción",
                    critico: "Revisión del guion",
                    verificador: "Verificación",
                    correccion: "Cambios solicitados",
                    calidad: "Control de calidad",
                  }[r.incidencia.tipo]
                }
              </p>
              <Link className={styles.enlace} href={r.href}>
                {r.titulo} ↗
              </Link>
              <Origen
                ambito={resultado.ambitos.find((a) => a.id === r.ambitoId)!}
                simulada={r.simulada}
              />
            </div>
            <div>
              <span className={styles.etiqueta}>
                {r.incidencia.estado === "corregido"
                  ? "Corregido"
                  : "Pendiente"}
              </span>
              <h3>{r.incidencia.resumen}</h3>
              <p>
                {r.incidencia.cambio ||
                  "Todavía no hay una corrección registrada."}
              </p>
              {r.incidencia.corregidoEn && (
                <p className={styles.meta}>
                  Corregido el {fecha(r.incidencia.corregidoEn)}
                </p>
              )}
            </div>
          </article>
        ))}
        {!visibles.length && (
          <p className={styles.sinFallos}>
            No hay fallos registrados en este estado.
          </p>
        )}
      </section>
    </div>
  );
}
