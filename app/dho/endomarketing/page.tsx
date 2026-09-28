import { redirect } from "next/navigation";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { listarEventosCalendario, obterOrcamentoAnual } from "@/lib/db/dho";
import { PageHeader } from "@/components/shared/PageHeader";
import { EndomarketingDashboardClient, type AbaEndomarketing } from "@/components/modules/dho/EndomarketingDashboardClient";

export const metadata = { title: "Endomarketing — Portal Recursos Humanos" };

const ANO_ATUAL = new Date().getFullYear();
const ABAS_VALIDAS: AbaEndomarketing[] = ["calendario", "lancamentos", "orcamento"];

export default async function EndomarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") redirect("/sem-acesso");

  const abaParam = (await searchParams).aba;
  const aba: AbaEndomarketing = ABAS_VALIDAS.includes(abaParam as AbaEndomarketing) ? (abaParam as AbaEndomarketing) : "calendario";

  const [eventos, orcamento] = await Promise.all([listarEventosCalendario(ANO_ATUAL), obterOrcamentoAnual(ANO_ATUAL)]);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="DHO · Endomarketing" titulo="Dashboard" subtitulo="Calendário de ações e datas comemorativas" />
      <EndomarketingDashboardClient aba={aba} anoInicial={ANO_ATUAL} eventosIniciais={eventos} orcamentoInicial={orcamento} />
    </div>
  );
}
