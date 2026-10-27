"use client";

import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { BeneficiosDashboardTab } from "./BeneficiosDashboardTab";
import { DocumentosTab } from "./DocumentosTab";
import { RateioTab } from "./RateioTab";

type Aba = "dashboard" | "rateio" | "documentos";

const INFO: Record<Aba, { titulo: string; subtitulo: string }> = {
  dashboard: { titulo: "Benefícios", subtitulo: "Custo de VT, VA e demais benefícios por colaborador e por setor" },
  rateio: {
    titulo: "Rateio de benefícios",
    subtitulo: "Distribuição do custo de cada benefício entre setores e colaboradores",
  },
  documentos: { titulo: "Documentos", subtitulo: "Documentos mensais dos benefícios e contratos" },
};

export function BeneficiosPageClient() {
  const searchParams = useSearchParams();
  const param = searchParams.get("aba");
  const aba: Aba = param === "rateio" || param === "documentos" ? param : "dashboard";

  return (
    <div className="space-y-5">
      {/* A aba de rateio desenha o próprio cabeçalho, com Exportar/Importar
          na mesma linha do título. */}
      {aba === "dashboard" && (
        <PageHeader eyebrow="Benefícios" titulo={INFO[aba].titulo} subtitulo={INFO[aba].subtitulo} />
      )}

      {aba === "dashboard" && <BeneficiosDashboardTab />}
      {aba === "rateio" && <RateioTab />}
      {aba === "documentos" && <DocumentosTab />}
    </div>
  );
}
