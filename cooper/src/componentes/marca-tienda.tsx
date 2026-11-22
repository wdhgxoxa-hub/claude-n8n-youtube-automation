import {
  calcularConversionTienda,
  calendarioTienda,
  metricasConversionEjemplo,
  metricasTienda,
  pendientesTienda,
  pilaresTienda,
  requisitosCatalogoTienda,
} from "@/servicios/marcas/tienda-contenido";
import { Cifra } from "./primitivas";

const conversionSinDatos = calcularConversionTienda();
const conversionEjemplo = calcularConversionTienda(metricasConversionEjemplo);

function MetricasTienda({ ejemplo = false }: { ejemplo?: boolean }) {
  const valores = ejemplo ? conversionEjemplo : conversionSinDatos;
  return (
    <div
      className="tienda-metricas"
      role="group"
      aria-label={
        ejemplo
          ? "Conversión ficticia de ejemplo"
          : "Conversión real sin conectar"
      }
    >
      {metricasTienda.map((metrica) => {
        const valor = valores[metrica.id];
        return (
          <div key={metrica.id} className="tienda-metrica">
            <Cifra
              valor={valor}
              etiqueta={metrica.nombre}
              variacion={
                metrica.unidad === "PEN" ? "Soles por pedido" : "Porcentaje"
              }
            />
            <p className="tienda-formula">{metrica.formula}</p>
            <p>{metrica.definicion}</p>
            {valor === null && <span className="sr-only">Sin datos</span>}
          </div>
        );
      })}
    </div>
  );
}

export function PanelMarcaTienda({ zona }: { zona: string }) {
  return (
    <div className="tienda-panel">
      <section aria-labelledby="tienda-especialista">
        <p className="tienda-aviso">
          Plantilla de ejemplo · Pendiente de definición con Walter
        </p>
        <h3 id="tienda-especialista">Historias que visten tu marca</h3>
        <p className="tienda-introduccion">
          Una base para la futura tienda de ropa. Estos cinco pilares ayudan a
          presentar cada prenda, inspirar combinaciones y acompañar la compra.
          Los productos, la identidad y las condiciones comerciales están por
          definir.
        </p>
        <div className="tienda-pilares">
          {pilaresTienda.map((pilar, i) => (
            <article key={pilar.id} className="tienda-pilar">
              <span className="tienda-numero" aria-hidden="true">
                0{i + 1}
              </span>
              <div>
                <h4>{pilar.nombre}</h4>
                <p>{pilar.objetivo}</p>
                <small>Formato sugerido: {pilar.formato}</small>
                <details>
                  <summary>Idea para {pilar.nombre.toLowerCase()}</summary>
                  <p>{pilar.brief}</p>
                </details>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="tienda-calendario" className="tienda-seccion">
        <h3 id="tienda-calendario">Calendario editorial de ejemplo</h3>
        <p>
          Semana orientativa en {zona}. Horarios de ejemplo, sin resultados
          previos que los respalden. Son propuestas sin fecha ni publicación
          programada.
        </p>
        <ol className="tienda-calendario">
          {calendarioTienda.map((pieza) => (
            <li key={pieza.pilarId}>
              <div className="tienda-dia">
                <strong>{pieza.dia}</strong>
                <span>{pieza.hora}</span>
              </div>
              <div>
                <h4>{pieza.titulo}</h4>
                <p>
                  {pieza.formato} · {pieza.objetivo}
                </p>
                <small>Propuesta · No programada</small>
              </div>
            </li>
          ))}
        </ol>
        <p className="tienda-nota">
          Para convertir una propuesta en pieza, define sus datos, registra una
          cuenta y usa Calendario. Walter revisa cada pieza antes de
          programarla. Guardar esta plantilla no crea cuentas ni publicaciones.
        </p>
      </section>

      <section aria-labelledby="tienda-conversion" className="tienda-seccion">
        <h3 id="tienda-conversion">Conversión de la tienda</h3>
        <p>
          Sin fuente de ventas conectada. Las métricas reales se mantienen sin
          datos; el alcance y las interacciones de redes no equivalen a compras.
        </p>
        <MetricasTienda />
        <p className="tienda-nota">
          Se compararán datos de la misma fuente y periodo, con moneda y
          atribución acordadas. Un denominador ausente o igual a cero se muestra
          como «Sin datos».
        </p>
        <details className="tienda-ejemplo">
          <summary>Ver cálculo con datos ficticios</summary>
          <p>
            Ejemplo didáctico, ajeno a esta marca: 1.000 sesiones, 120 con
            carrito, 60 con inicio de compra y 30 con compra; 32 pedidos e
            ingresos de S/ 3.840. PEN es una moneda de ejemplo pendiente de
            confirmar. No son resultados ni objetivos de la tienda.
          </p>
          <MetricasTienda ejemplo />
        </details>
      </section>

      <section aria-labelledby="tienda-catalogo" className="tienda-seccion">
        <div className="tienda-cabecera">
          <h3 id="tienda-catalogo">Catálogo web futuro</h3>
          <span className="tienda-estado">Desconectado</span>
        </div>
        <p>
          Plataforma y dirección web por definir. No hay productos importados ni
          sincronización activa. La futura conexión de lectura necesita la
          plataforma elegida y autorización de Walter.
        </p>
        <details className="tienda-requisitos">
          <summary>Datos que necesitará el catálogo</summary>
          <dl>
            {requisitosCatalogoTienda.map((requisito) => (
              <div key={requisito.campo}>
                <dt>{requisito.campo}</dt>
                <dd>{requisito.detalle}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      <section aria-labelledby="tienda-pendientes" className="tienda-seccion">
        <h3 id="tienda-pendientes">Pendientes de Walter</h3>
        <ul className="tienda-pendientes">
          {pendientesTienda.map((pendiente) => (
            <li key={pendiente}>{pendiente}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
