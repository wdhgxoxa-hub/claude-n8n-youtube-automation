import { notFound } from "next/navigation";
import { currentUser } from "@/lib/sesion";
import { SaludOperativa } from "@/componentes/salud-operativa";

export const metadata = { title: "Salud de la operación" };

export default async function Page() {
  const user = await currentUser();
  if (user.role !== "admin") notFound();
  return <SaludOperativa />;
}
