import { currentUser } from "@/lib/sesion";
import { failure, rateLimit } from "@/lib/http";
import { leerOperacion, leerAjustes } from "@/servicios/operacion";
import {
  PantallaOperacion,
  type VistaOperacion,
  type DatosInicialesOperacion,
} from "./operacion";

// La misma consulta autorizada de la API se resuelve durante el render dinámico.
// El loading.tsx del estudio conserva el estado de espera si n8n tarda.
export async function OperacionInicial({
  vista,
  canalId,
}: {
  vista: VistaOperacion;
  canalId?: string;
}) {
  const user = await currentUser();
  const initial: DatosInicialesOperacion = {
    op: null,
    ajustes: null,
    error: "",
  };
  try {
    rateLimit(`read:${user.id}`, 300);
    if (vista === "ajustes") initial.ajustes = await leerAjustes(user);
    else initial.op = await leerOperacion(user);
  } catch (error) {
    // Reutilizar la redacción pública de errores de la API, sin detalles internos.
    initial.error = (await failure(error).json()).error;
  }
  return (
    <PantallaOperacion vista={vista} canalId={canalId} initial={initial} />
  );
}
