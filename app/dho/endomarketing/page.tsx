import { redirect } from "next/navigation";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { listarEventosCalendario } from "@/lib/db/dho";
import { PageHeader } from "@/components/shared/PageHeader";
import { EndomarketingDashboardClient } from "@/components/modules/dho/EndomarketingDashboardClient";

export const metadata = { title: "Endomarketing — Portal Recursos Humanos" };

const ANO_ATUAL = new Date().getFullYear();

export default async function EndomarketingPage() {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") redirect("/sem-acesso");

  const eventos = await listarEventosCalendario(ANO_ATUAL);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="DHO · Endomarketing" titulo="Dashboard" subtitulo="Calendário de ações e datas comemorativas" />
      <EndomarketingDashboardClient anoInicial={ANO_ATUAL} eventosIniciais={eventos} />
    </div>
  );
}
