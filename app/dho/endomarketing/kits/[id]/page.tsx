import { notFound, redirect } from "next/navigation";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { obterKit } from "@/lib/db/dho";
import { PageHeader } from "@/components/shared/PageHeader";
import { KitDetalheClient } from "@/components/modules/dho/KitDetalheClient";

export const metadata = { title: "Kit — Portal Recursos Humanos" };

export default async function KitDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") redirect("/sem-acesso");

  const { id } = await params;
  const kit = await obterKit(Number(id));
  if (!kit) notFound();

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="DHO · Endomarketing" titulo={kit.nome} subtitulo="Materiais, estoque e histórico de entregas" />
      <KitDetalheClient kitInicial={kit} />
    </div>
  );
}
