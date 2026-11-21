import Link from "next/link";
export default function NotFound() {
  return (
    <div className="standalone">
      <h1>Este espacio no está disponible.</h1>
      <p>Comprueba el enlace o vuelve a tus videos.</p>
      <Link className="button" href="/">
        Volver al inicio
      </Link>
    </div>
  );
}
