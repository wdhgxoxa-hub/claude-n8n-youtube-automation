import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import "@/componentes/resto-diseno.css";

// El layout del estudio ya proporciona el landmark principal.
export default function NotFound() {
  return (
    <div className="page estado-diseno">
      <span className="resto-eyebrow">Fuera de escena · 404</span>
      <h1>Este espacio no está disponible.</h1>
      <p>Comprueba el enlace o vuelve a tus videos.</p>
      <Link className="button" href="/videos">
        Ver mis videos
        <ArrowUpRight size={17} />
      </Link>
    </div>
  );
}
