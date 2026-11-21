import { PantallaOperacion } from "@/componentes/operacion";
export const metadata = { title: "Especialistas y redes" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ canal?: string }>;
}) {
  const { canal } = await searchParams;
  return <PantallaOperacion vista="redes" canalId={canal} />;
}
