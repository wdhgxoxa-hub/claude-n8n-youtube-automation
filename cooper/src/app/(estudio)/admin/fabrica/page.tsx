import { PantallaOperacion } from "@/componentes/operacion";
import { currentUser } from "@/lib/sesion";
import { requireAdmin } from "@/lib/permisos";
export const metadata = { title: "Ajustes de fábrica" };
export default async function Page() {
  requireAdmin(await currentUser());
  return <PantallaOperacion vista="ajustes" />;
}
