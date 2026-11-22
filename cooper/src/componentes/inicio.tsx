"use client";
import Link from "next/link";
import { ArrowUpRight, Clapperboard } from "lucide-react";
import { useEspacio, Empty } from "./espacio";
import { FabricaVista, VideoMini } from "./fabrica-vista";
import { Entrada } from "./movimiento";
import { Cifra } from "./primitivas";
import { esperaAprobacion } from "@/lib/etapas";
export function Inicio() {
  const { data } = useEspacio();
  const propios = data.videos.filter((v) => v.ownerId === data.user.id);
  const pendientes = propios.filter(
    (v) => v.productionState === "activa" && esperaAprobacion(v.stage),
  );
  return (
    <div className="page home-base">
      <div className="home-title">
        <div>
          <p className="eyebrow">COOPER / ESTUDIO</p>
          <h1>
            Hoy en el estudio<span className="title-stop">.</span>
          </h1>
          <p>De la primera idea al momento de compartirla.</p>
        </div>
        <Link href="/videos" className="button secondary">
          Abrir fábrica <ArrowUpRight size={18} />
        </Link>
      </div>
      {propios.length ? (
        <>
          <section className="home-overview" aria-label="Tu estudio en cifras">
            <Cifra etiqueta="En producción" valor={propios.filter((v) => v.stage < 11).length} heroe />
            <Cifra etiqueta="Por revisar" valor={pendientes.length} heroe />
            <Cifra etiqueta="Publicados" valor={propios.filter((v) => v.stage === 11).length} heroe />
          </section>
          {pendientes.length > 0 && (
            <section className="home-pending">
              <div className="section-heading">
                <h2>Te toca a ti</h2>
                <span>{pendientes.length} por revisar</span>
              </div>
              <div className="home-pending-grid">
                {pendientes.slice(0, 4).map((v, i) => (
                  <Entrada key={v.id} orden={i}><VideoMini video={v} /></Entrada>
                ))}
              </div>
            </section>
          )}
          <FabricaVista
            panelId="fabrica-inicio"
            tabId="fabrica-inicio-titulo"
          />
        </>
      ) : (
        <Empty
          title="Una idea. Todo por crear."
          description="Crea tu primer canal y dale un lugar a tu próxima historia."
        >
          <Link className="button" href="/canales">
            <Clapperboard size={18} />
            Crear mi primer canal
          </Link>
          <p className="helper">
            Cooper te acompaña desde el botón de la esquina.
          </p>
        </Empty>
      )}
    </div>
  );
}
