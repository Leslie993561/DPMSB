import { redirect } from "next/navigation";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { CATALOGO_EXAMES_OCUPACIONAIS } from "@/lib/sst/domain";
import { listarColaboradoresParaExames, obterCustosExames, obterMatrizExames, obterMatrizRiscos } from "@/lib/sst/exames";
import { PageHeader } from "@/components/shared/PageHeader";
import { ExamesPageClient, type AbaExames } from "@/components/modules/sst/ExamesPageClient";

export const metadata = { title: "Exames Ocupacionais — Portal Recursos Humanos" };

const ABAS_VALIDAS: AbaExames[] = ["colaboradores", "matriz", "ocupacional", "custos"];

export default async function SstExamesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // proxy.ts já bloqueia /sst/* pra quem não é administrador; checagem extra
  // aqui só por segurança (mesmo padrão da Gestão de EPI).
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") {
    redirect("/sem-acesso");
  }

  const abaParam = (await searchParams).aba;
  const aba: AbaExames = ABAS_VALIDAS.includes(abaParam as AbaExames) ? (abaParam as AbaExames) : "colaboradores";

  const [colaboradores, matrizExames, matrizRiscos, custos] = await Promise.all([
    listarColaboradoresParaExames(),
    obterMatrizExames(),
    obterMatrizRiscos(),
    obterCustosExames(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="SST" titulo="Exames Ocupacionais" subtitulo="Colaboradores, matriz por função, matriz ocupacional e custos" />
      <ExamesPageClient
        aba={aba}
        colaboradores={colaboradores}
        matrizExames={matrizExames}
        matrizRiscos={matrizRiscos}
        catalogoExames={CATALOGO_EXAMES_OCUPACIONAIS.map((c) => c.nome)}
        custos={custos}
      />
    </div>
  );
}
