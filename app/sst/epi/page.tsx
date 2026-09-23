import { redirect } from "next/navigation";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { listarColaboradoresParaEpi, MATRIZ_EPI, obterCustosEpi, obterCustosFardamento } from "@/lib/sst/epi";
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

  const [colaboradores, custos, fardamento] = await Promise.all([
    listarColaboradoresParaEpi(),
    obterCustosEpi(),
    obterCustosFardamento(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="SST" titulo="Gestão de EPI" subtitulo="Colaboradores, matriz por função e custos" />
      <EpiPageClient aba={aba} colaboradores={colaboradores} matriz={MATRIZ_EPI} custos={custos} fardamento={fardamento} />
    </div>
  );
}
