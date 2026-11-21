import { PantallaOperacion } from "@/componentes/operacion";
export const metadata = { title: "Rutina y metas" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ canal?: string }>;
}) {
  const { canal } = await searchParams;
  return <PantallaOperacion vista="rutina" canalId={canal} />;
}
