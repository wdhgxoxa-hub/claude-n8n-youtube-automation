import { Publicados } from "@/componentes/resultados";
import { currentUser } from "@/lib/sesion";
import { leerResultados } from "@/servicios/resultados";
export default async function Page() {
  return <Publicados initial={leerResultados(await currentUser())} />;
}
