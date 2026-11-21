import { Aprendizaje } from "@/componentes/resultados";
import { currentUser } from "@/lib/sesion";
import { leerResultados } from "@/servicios/resultados";
export const metadata = { title: "Aprendizaje" };
export default async function Page() {
  return <Aprendizaje initial={leerResultados(await currentUser())} />;
}
