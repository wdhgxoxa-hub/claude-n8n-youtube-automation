import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/marca/Logo";
import "@/componentes/resto-diseno.css";
export default function NotFound() {
  return (
    <main className="standalone estado-diseno">
      <Logo size={48} />
      <span className="resto-eyebrow">Fuera de escena · 404</span>
      <h1>Este espacio no está disponible.</h1>
      <p>Comprueba el enlace o vuelve a tus videos.</p>
      <Link className="button" href="/">
        Volver al inicio
        <ArrowUpRight size={17} />
      </Link>
    </main>
  );
}
