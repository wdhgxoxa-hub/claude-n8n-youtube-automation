import { OperacionInicial } from "@/componentes/operacion-inicial";
export const metadata = { title: "Radar" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ canal?: string }>;
}) {
  const { canal } = await searchParams;
  return <OperacionInicial vista="radar" canalId={canal} />;
}
