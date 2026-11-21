import { OperacionInicial } from "@/componentes/operacion-inicial";
import { currentUser } from "@/lib/sesion";
import { requireAdmin } from "@/lib/permisos";
export const metadata = { title: "Ajustes de fábrica" };
export default async function Page() {
  requireAdmin(await currentUser());
  return <OperacionInicial vista="ajustes" />;
}
