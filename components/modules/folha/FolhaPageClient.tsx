"use client";

import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { BreakdownDashboardTab } from "./BreakdownDashboardTab";
import { RelatorioDetalhadoTab } from "./RelatorioDetalhadoTab";
import { HoraExtraTab } from "./HoraExtraTab";

type Aba = "dashboard" | "relatorio" | "hora-extra";

const INFO: Record<Aba, { titulo: string; subtitulo: string }> = {
  dashboard: { titulo: "Dashboard", subtitulo: "Custo por verba, colaborador a colaborador" },
  relatorio: { titulo: "Relatório detalhado", subtitulo: "Todas as verbas, exportável em planilha" },
  "hora-extra": { titulo: "Hora extra", subtitulo: "Adicional de 50% ou 100% e reflexo no DSR" },
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
      {aba === "hora-extra" && <HoraExtraTab />}
    </div>
  );
}
