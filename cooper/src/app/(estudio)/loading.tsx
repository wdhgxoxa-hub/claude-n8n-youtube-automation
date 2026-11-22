import { Skeleton } from "@/componentes/espacio";
export default function Loading() {
  return (
    <div className="page" data-ruta-cargando aria-busy="true">
      <Skeleton />
    </div>
  );
}
