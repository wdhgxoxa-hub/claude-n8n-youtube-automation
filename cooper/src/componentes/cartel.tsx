import "./cartel.css";

/**
 * Póster tipográfico: la carátula de una pieza sin miniatura ni MP4.
 *
 * Única primitiva para todos los tamaños (héroe, tarjetas, cápsulas,
 * miniaturas, pared y reproductor). Ocupa el contenedor completo con
 * posición absoluta, así que nunca cambia la caja reservada (sin CLS); el
 * tamaño del título lo decide el propio cartel con container queries.
 * El tinte llega por la variable heredada --tinte del medio.
 */
export function Cartel({
  titulo,
  canal,
  detalle,
}: {
  titulo: string;
  /** Marca o canal; se muestra como firma editorial en Geist Mono. */
  canal?: string;
  /** Número o etapa («Etapa 04», «N.º 3»); detalle editorial a la derecha. */
  detalle?: string;
}) {
  const firma = canal?.trim();
  return (
    <span className="cartel" aria-hidden="true">
      {/* Las unidades cqi/cqh se resuelven contra .cartel: la composición
          interior puede medir su aire y su título en proporción a la pieza. */}
      <span className="cartel-composicion">
        {(firma || detalle) && (
          <span className="cartel-cabecera">
            <span className="cartel-canal">{firma}</span>{" "}
            {detalle && <span className="cartel-detalle">{detalle}</span>}
          </span>
        )}
        {/* Los espacios (invisibles en flex) separan las palabras en el texto
            del cartel: «N.º 01 Título», no «N.º 01Título» (WCAG 2.5.3). */}{" "}
        <span className="cartel-titulo" data-poster="tipografico">
          {titulo}
        </span>
      </span>
    </span>
  );
}
