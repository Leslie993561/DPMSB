import { redirect } from "next/navigation";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import {
  EPI_CATALOGO,
  listarColaboradoresParaEpi,
  obterCaExtraEpi,
  obterMatrizEpi,
  obterCustosEpi,
  obterCustosFardamento,
} from "@/lib/sst/epi";
import { obterResumoFichas } from "@/lib/sst/fichas";
import { PageHeader } from "@/components/shared/PageHeader";
import { EpiPageClient, type AbaEpi } from "@/components/modules/sst/EpiPageClient";

export const metadata = { title: "Gestão de EPI — Portal Recursos Humanos" };

const ABAS_VALIDAS: AbaEpi[] = ["colaboradores", "matriz", "custos"];

export default async function SstEpiPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // proxy.ts já bloqueia /sst/* pra quem não é administrador; checagem extra
  // aqui só por segurança (mesmo padrão do Dashboard SST).
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") {
    redirect("/sem-acesso");
  }

  // Aba lida no servidor e passada como prop: com useSearchParams + Suspense o
  // conteúdo chegava pronto mas ficava escondido atrás do "Carregando...".
  const abaParam = (await searchParams).aba;
  const aba: AbaEpi = ABAS_VALIDAS.includes(abaParam as AbaEpi) ? (abaParam as AbaEpi) : "colaboradores";

  const [colaboradores, matriz, custos, fardamento, resumoFichas, caExtra] = await Promise.all([
    listarColaboradoresParaEpi(),
    obterMatrizEpi(),
    obterCustosEpi(),
    obterCustosFardamento(),
    obterResumoFichas(),
    obterCaExtraEpi(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="SST" titulo="Gestão de EPI" subtitulo="Colaboradores, matriz por função e custos" />
      <EpiPageClient
        aba={aba}
        colaboradores={colaboradores}
        matriz={matriz}
        catalogoEpi={EPI_CATALOGO.map((c) => c.equip)}
        custos={custos}
        fardamento={fardamento}
        resumoFichas={resumoFichas}
        caExtra={Object.fromEntries(caExtra)}
      />
    </div>
  );
}
