import { Esqueleto } from "@/componentes/primitivas";
import "@/componentes/resto-diseno.css";
export default function Loading() {
  return (
    <div className="page carga-diseno" aria-busy="true">
      <Esqueleto className="carga-titulo" etiqueta="Preparando tu espacio" />
      <div className="carga-contenido" aria-hidden="true">
        <div className="esqueleto carga-protagonista" />
        <div className="carga-lineas">
          <div className="esqueleto" />
          <div className="esqueleto" />
          <div className="esqueleto" />
        </div>
        <div className="esqueleto carga-tarjeta" />
        <div className="esqueleto carga-tarjeta" />
      </div>
    </div>
  );
}
