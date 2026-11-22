"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
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
import { nombreRed } from "@/lib/redes";
import { proporcionPublicacion, tinteEstable } from "@/lib/reticula";
import { Filtros, Origen, useResultados } from "./resultados";
import { nombreMedio } from "./transiciones";
import "./cartela-pieza.css";
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
  const proporcion =
    medio && medio.origenDimensiones !== "reserva"
      ? medio.relacionAspecto
      : publicacion
        ? proporcionPublicacion(publicacion)
        : (medio?.relacionAspecto ?? 16 / 9);
  return (
    <>
      <Link
        href={`/videos/${encodeURIComponent(origen.videoId)}`}
        className={styles.enlaceMedio}
      >
        <span className="sr-only">Ver video: </span>
        <div
          data-video-transition={nombreMedio(origen.videoId)}
          className="cartela-pieza"
          data-cartela="mini"
        >
          <Medio
            poster={medio?.poster?.url}
            preview={medio?.preview?.url}
            alt={titulo}
            videoId={origen.videoId}
            tinte={medio?.tinte ?? tinteEstable(ambitoId)}
            mediosIniciales={medio}
            publicacionId={publicacion?.publicacion.id}
            proporcion={proporcion < 1 ? "vertical" : "horizontal"}
            className={styles.miniatura}
          />
        </div>
      </Link>
      <p className={styles.tituloVideo}>{titulo}</p>
      <p className={styles.meta}>
        {nombreRed(origen.red)} · {origen.ventana} · {fecha(origen.fecha)}
      </p>
    </>
  );
}

function Paso({
  numero: n,
  titulo,
  clase,
  children,
}: {
  numero: number;
  titulo: string;
  clase?: string;
  children: ReactNode;
}) {
  return (
    <li className={`${styles.pasoItem} ${clase ?? ""}`}>
      <span className={styles.etiquetaPaso}>
        <span className={styles.nPaso} aria-hidden="true">
          {n}
        </span>
        {titulo}
      </span>
      {children}
    </li>
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
  return origen && siguiente && valor != null ? (
    <>
      <Cifra
        valor={origen.metrica === "retencion" ? Math.round(valor * 100) : valor}
        etiqueta={`${metricas[origen.metrica]}${origen.metrica === "retencion" ? " (%)" : ""}`}
        variacion={`Antes: ${numero(valorEvidencia(origen))}${origen.metrica === "retencion" ? " %" : ""} · ${origen.ventana}${origen.segundo !== undefined ? ` · segundo ${numero(origen.segundo)}` : ""}`}
        className={styles.cifraPaso}
      />
      <Link className={styles.enlace} href={siguiente.href}>
        <span>{siguiente.titulo}</span>
        <span aria-hidden="true">↗</span>
      </Link>
      <p className={styles.meta}>
        Resultado observado. Todavía no demuestra que el cambio sea la causa.
      </p>
    </>
  ) : (
    <>
      <p className={styles.espera}>Esperando el siguiente resultado</p>
      <p className={styles.meta}>
        {l.aplicaciones?.length
          ? "Ya está aplicado. Falta medir el siguiente video."
          : "Primero aplicamos el cambio; luego comparamos con la misma red y el mismo periodo."}
      </p>
    </>
  );
}

function LeccionEnTiempo({
  registro,
  resultado,
  indice,
  propietarios,
}: {
  registro: LeccionVideo;
  resultado: Resultados;
  indice: number;
  propietarios: boolean;
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
                ? "Se repite en varios videos"
                : l.origenes?.length
                  ? "Por comprobar"
                  : "Apunte anterior"}
            </span>
          </div>
          <h2>{registro.titulo}</h2>
          <Origen
            ambito={resultado.ambitos.find((a) => a.id === registro.ambitoId)!}
            simulada={registro.simulada}
            conPropietario={propietarios}
          />
        </header>
        <ol className={styles.pasos} aria-label="Cómo llegamos a esta lección">
          <Paso numero={1} titulo="El video" clase={styles.pasoVideo}>
            {origen ? (
              <VideoOrigen
                origen={origen}
                resultado={resultado}
                ambitoId={registro.ambitoId}
              />
            ) : (
              <>
                <p>No hay un video enlazado a este apunte.</p>
                <Link className={styles.enlace} href={registro.href}>
                  Ver el canal ↗
                </Link>
              </>
            )}
          </Paso>
          <Paso numero={2} titulo="Lo que falló">
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
              className={styles.cifraPaso}
            />
          </Paso>
          <Paso numero={3} titulo="Posible causa">
            <p>{l.causa || "Todavía no la hemos contrastado con los datos."}</p>
            <p className={styles.meta}>
              {l.nivel === "patron"
                ? "Se repite en tres o más videos; falta comprobar la causa."
                : "Una pista para probar, todavía no una conclusión."}
            </p>
          </Paso>
          <Paso
            numero={4}
            titulo={
              l.aplicaciones?.length ? "Cambio aplicado" : "Cambio propuesto"
            }
          >
            <p>{l.correccion || "Aún no hay un cambio concreto."}</p>
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
                    <span className={styles.meta}>{a.cambio}</span>
                  </li>
                ))}
              </ul>
            )}
            {!l.aplicaciones?.length && (
              <p className={styles.meta}>
                Pendiente de aplicar en el siguiente guion.
              </p>
            )}
          </Paso>
          <Paso numero={5} titulo="El siguiente video">
            <EfectoSiguiente registro={registro} resultado={resultado} />
          </Paso>
        </ol>
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
                  {` · ${nombreRed(o.red)} · ${o.ventana} · ${metricas[o.metrica]}: ${numero(valorEvidencia(o))}${o.metrica === "retencion" ? " %" : ""}`}
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
        <ol className={styles.pasos}>
          <Paso numero={1} titulo="El video">
            <p>Una pregunta sobre el mar</p>
          </Paso>
          <Paso numero={2} titulo="Lo que falló">
            <p>40 % sigue mirando a los 3{"\u00a0"}s</p>
          </Paso>
          <Paso numero={3} titulo="Posible causa">
            <p>La explicación tarda en llegar</p>
          </Paso>
          <Paso numero={4} titulo="Cambio">
            <p>Abrir con la respuesta</p>
          </Paso>
          <Paso numero={5} titulo="El siguiente video">
            <p>Medir antes de sacar conclusiones</p>
          </Paso>
        </ol>
      </div>
      <Link className="boton boton-secundario" href="/publicados">
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
  const propietarios =
    data.user.role === "admin" &&
    new Set(resultado.ambitos.map((a) => a.ownerId)).size > 1;
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
              propietarios={propietarios}
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
                  {fecha(l.fecha)} ·{" "}
                  {l.redes.map(nombreRed).join(" · ") || "Todas las redes"}
                </p>
                <h3>{l.titulo}</h3>
                <Origen
                  ambito={resultado.ambitos.find((a) => a.id === l.ambitoId)!}
                  simulada={l.simulada}
                  conPropietario={propietarios}
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
                conPropietario={propietarios}
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
