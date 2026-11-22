import Link from "next/link";
import { EntradaMovimiento } from "@/componentes/entrada-movimiento";

// El layout del estudio ya proporciona el landmark principal.
export default function NotFound() {
  return (
    <div className="page stack estado-espacio">
      <EntradaMovimiento motivo="archivo" />
      <h1>Este espacio no está disponible.</h1>
      <p>Comprueba el enlace o vuelve a tus videos.</p>
      <Link className="button" href="/videos">
        Ver mis videos
      </Link>
    </div>
  );
}
