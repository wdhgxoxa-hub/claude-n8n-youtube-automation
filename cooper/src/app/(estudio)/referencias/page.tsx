import { PantallaOperacion } from "@/componentes/operacion";
export const metadata = { title: "Referencias" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ canal?: string }>;
}) {
  const { canal } = await searchParams;
  return <PantallaOperacion vista="referencias" canalId={canal} />;
}
