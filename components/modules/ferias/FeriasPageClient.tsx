"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { ControleDeFeriasTab } from "./ControleDeFeriasTab";
import { PlanejamentoDeFeriasTab } from "./PlanejamentoDeFeriasTab";

type Aba = "controle" | "planejamento";

const INFO: Record<Aba, { titulo: string; subtitulo: string }> = {
  controle: { titulo: "Controle de Férias", subtitulo: "Períodos aquisitivos em aberto, alertas e histórico" },
  planejamento: { titulo: "Planejamento de Férias", subtitulo: "Programação anual por trimestre e conflitos de agenda" },
};

const ABAS_VALIDAS = new Set<string>(Object.keys(INFO));

const ANO_ATUAL = new Date().getFullYear();
const ANOS_DISPONIVEIS = [ANO_ATUAL, ANO_ATUAL + 1, ANO_ATUAL + 2];

/** Navegação entre visões via sidebar (?aba=), sem barra de abas duplicada dentro da página. */
export function FeriasPageClient() {
  const searchParams = useSearchParams();
  const abaParam = searchParams.get("aba");
  const aba: Aba = abaParam && ABAS_VALIDAS.has(abaParam) ? (abaParam as Aba) : "controle";
  const [simuladorAberto, setSimuladorAberto] = useState(false);
  const [ano, setAno] = useState(ANO_ATUAL);
  const [lancarAberto, setLancarAberto] = useState(false);
  const [importarAberto, setImportarAberto] = useState(false);
  const [exportarAberto, setExportarAberto] = useState(false);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Férias"
        titulo={INFO[aba].titulo}
        subtitulo={INFO[aba].subtitulo}
        acao={
          aba === "controle" ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setExportarAberto(true)}
                className="flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-[12.5px] font-medium text-brand-white shadow-card transition-colors hover:bg-brand-primary-hover"
              >
                <span aria-hidden>↓</span> Exportar arquivo
              </button>
              {/* A importação do relatório do DP continua aqui, em segundo plano:
                  é ela que alimenta os períodos que a exportação depois publica. */}
              <button
                type="button"
                onClick={() => setImportarAberto(true)}
                className="flex items-center gap-1.5 rounded border border-hairline px-3 py-1.5 text-[12.5px] font-medium text-foreground-muted transition-colors hover:bg-surface-page"
              >
                <span aria-hidden>↑</span> Importar arquivo
              </button>
            </div>
          ) : aba === "planejamento" ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSimuladorAberto((v) => !v)}
                className="flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-[12.5px] font-medium text-brand-white shadow-card transition-colors hover:bg-brand-primary-hover"
              >
                <span aria-hidden>🧮</span> Simulador de férias
              </button>
              <button
                type="button"
                onClick={() => setLancarAberto(true)}
                className="flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-[12.5px] font-medium text-brand-white shadow-card transition-colors hover:bg-brand-primary-hover"
              >
                <span aria-hidden>+</span> Lançar programação
              </button>
              <select
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
                className="rounded-md border border-hairline bg-background px-2.5 py-1.5 text-xs text-foreground dark:border-brand-neutral/30"
              >
                {ANOS_DISPONIVEIS.map((a) => (
                  <option key={a} value={a}>
                    Ano {a}
                  </option>
                ))}
              </select>
            </div>
          ) : undefined
        }
      />

      {aba === "controle" && (
        <ControleDeFeriasTab
          importarAberto={importarAberto}
          onFecharImportar={() => setImportarAberto(false)}
          exportarAberto={exportarAberto}
          onFecharExportar={() => setExportarAberto(false)}
        />
      )}
      {aba === "planejamento" && (
        <PlanejamentoDeFeriasTab
          simuladorAberto={simuladorAberto}
          ano={ano}
          lancarAberto={lancarAberto}
          onFecharLancar={() => setLancarAberto(false)}
        />
      )}
    </div>
  );
}
