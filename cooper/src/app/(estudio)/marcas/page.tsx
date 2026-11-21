import { Marcas } from "@/componentes/marcas";
import { currentUser } from "@/lib/sesion";
import { estadoMarcas } from "@/servicios/marcas/servicio";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ pieza?: string }>;
}) {
  const { pieza } = await searchParams;
  return <Marcas initial={estadoMarcas(await currentUser())} piezaId={pieza} />;
}
