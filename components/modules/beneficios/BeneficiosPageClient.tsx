"use client";

import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { BeneficiosDashboardTab } from "./BeneficiosDashboardTab";
import { RateioTab } from "./RateioTab";

type Aba = "dashboard" | "rateio";

const INFO: Record<Aba, { titulo: string; subtitulo: string }> = {
  dashboard: { titulo: "Benefícios", subtitulo: "Custo de VT, VA e demais benefícios por colaborador e por setor" },
  rateio: {
    titulo: "Rateio de benefícios",
    subtitulo: "Distribuição do custo de cada benefício entre setores e colaboradores",
  },
};

export function BeneficiosPageClient() {
  const searchParams = useSearchParams();
  const aba: Aba = searchParams.get("aba") === "rateio" ? "rateio" : "dashboard";

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Benefícios" titulo={INFO[aba].titulo} subtitulo={INFO[aba].subtitulo} />

      {aba === "dashboard" && <BeneficiosDashboardTab />}
      {aba === "rateio" && <RateioTab />}
    </div>
  );
}
