import { redirect } from "next/navigation";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { listarKits } from "@/lib/db/dho";
import { PageHeader } from "@/components/shared/PageHeader";
import { EstoqueKitsClient } from "@/components/modules/dho/EstoqueKitsClient";

export const metadata = { title: "Estoque de Kits — Portal Recursos Humanos" };

export default async function EstoqueKitsPage() {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") redirect("/sem-acesso");

  const kits = await listarKits();

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="DHO · Endomarketing" titulo="Estoque de Kits" subtitulo="Kit Onboarding e Kit MSB Reconhece" />
      <EstoqueKitsClient kitsIniciais={kits} />
    </div>
  );
}
