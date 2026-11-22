import { Esqueleto } from "@/componentes/primitivas";
import { RetenerEsqueleto } from "@/componentes/transiciones";
import "@/componentes/resto-diseno.css";
/**
 * Esqueleto de las secciones del estudio. Cada sección lo declara en su
 * `loading.tsx`; Inicio no, a propósito: un `loading.tsx` en la raíz del grupo
 * envolvía también la portada en un límite de Suspense y React la enviaba en
 * un bloque aparte (`<div hidden id="S:0">`) que revela un cuadro después del
 * esqueleto. El protagonista del Inicio llegaba tarde (LCP) aunque el HTML
 * completo estuviera listo a los 74 ms. Sin límite, Inicio sale en el primer
 * HTML; sus datos ya vienen del armazón.
 */
export default function CargaEstudio() {
  return (
    <div className="page carga-diseno" data-ruta-cargando aria-busy="true">
      <RetenerEsqueleto />
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
