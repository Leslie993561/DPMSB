"use client";

import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { BreakdownDashboardTab } from "./BreakdownDashboardTab";
import { RelatorioDetalhadoTab } from "./RelatorioDetalhadoTab";
import { HistoricoMovimentacoesTab } from "./HistoricoMovimentacoesTab";
import { DocumentosPorMes } from "@/components/shared/DocumentosPorMes";

type Aba = "dashboard" | "relatorio" | "movimentacoes" | "documentos";

const INFO: Record<Aba, { titulo: string; subtitulo: string }> = {
  dashboard: { titulo: "Dashboard", subtitulo: "Custo por verba, colaborador a colaborador" },
  relatorio: { titulo: "Relatório detalhado", subtitulo: "Todas as verbas, exportável em planilha" },
  documentos: { titulo: "Documentos DP", subtitulo: "Documentos do Departamento Pessoal anexados mês a mês" },
  movimentacoes: {
    titulo: "Histórico de movimentações",
    subtitulo: "Entradas e saídas de colaboradores mês a mês, pelas datas de admissão e desligamento",
  },
};

const ABAS_VALIDAS = new Set<string>(Object.keys(INFO));

export function FolhaPageClient() {
  const searchParams = useSearchParams();
  const abaParam = searchParams.get("aba");
  const aba: Aba = abaParam && ABAS_VALIDAS.has(abaParam) ? (abaParam as Aba) : "dashboard";

  return (
    <div className="space-y-5">
      {aba !== "relatorio" && <PageHeader eyebrow="Breakdown de Folha" titulo={INFO[aba].titulo} subtitulo={INFO[aba].subtitulo} />}

      {aba === "dashboard" && <BreakdownDashboardTab />}
      {aba === "relatorio" && <RelatorioDetalhadoTab />}
      {aba === "movimentacoes" && <HistoricoMovimentacoesTab />}
      {aba === "documentos" && <DocumentosPorMes categoria="folha-documentos" />}
    </div>
  );
}
