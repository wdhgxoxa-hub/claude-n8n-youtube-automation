import { notFound } from "next/navigation";
import { currentUser } from "@/lib/sesion";
import { administracionActual } from "@/servicios/datos";
import { Admin } from "@/componentes/admin";
export default async function Page() {
  const user = await currentUser();
  if (user.role !== "admin") notFound();
  return <Admin initial={await administracionActual(user)} />;
}
