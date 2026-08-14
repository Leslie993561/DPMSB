"use client";

import { useState } from "react";
import type { CalculoResult, DetalheFerias } from "@/lib/calc";
import { MemoriaCalculoTable } from "@/components/shared/MemoriaCalculoTable";
import { RiskCallout } from "@/components/shared/RiskCallout";
import { formatarMoeda } from "@/lib/format";

const INPUT_CLASS =
  "w-full rounded-md border border-brand-surface bg-background px-3 py-2 text-sm text-foreground dark:border-brand-neutral/30";

const hoje = () => new Date().toISOString().slice(0, 10);

interface RespostaSimulador {
  ferias: CalculoResult<DetalheFerias>;
  fgts: CalculoResult;
  adiantamento13: number;
  custoTotalEmpresa: number;
}

export function SimuladorFeriasTab() {
  const [salario, setSalario] = useState("3000");
  const [mediaVariaveis, setMediaVariaveis] = useState("0");
  const [diasFerias, setDiasFerias] = useState("30");
  const [venderAbono, setVenderAbono] = useState(false);
  const [adiantar13, setAdiantar13] = useState(false);
  const [dependentes, setDependentes] = useState("0");

  const [resposta, setResposta] = useState<RespostaSimulador | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const res = await fetch("/api/calc/simulador-ferias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salario: Number(salario),
          mediaVariaveis: Number(mediaVariaveis),
          diasFerias: Number(diasFerias),
          venderAbono,
          adiantar13,
          dependentes: Number(dependentes),
          competencia: hoje(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao simular férias.");
        return;
      }
      setResposta(data);
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-xl border border-brand-surface bg-background p-5 sm:grid-cols-2 dark:border-brand-neutral/30"
      >
        <label className="flex flex-col gap-1 text-sm text-foreground-muted">
          Salário
          <input type="number" min={0} step="0.01" value={salario} onChange={(e) => setSalario(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground-muted">
          Média de variáveis (horas extras, comissões etc.)
          <input type="number" min={0} step="0.01" value={mediaVariaveis} onChange={(e) => setMediaVariaveis(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground-muted">
          Dias de férias
          <input type="number" min={1} max={30} value={diasFerias} onChange={(e) => setDiasFerias(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground-muted">
          Dependentes (IRRF)
          <input type="number" min={0} value={dependentes} onChange={(e) => setDependentes(e.target.value)} className={INPUT_CLASS} />
        </label>

        <label className="flex items-center gap-2 text-sm text-foreground-muted">
          <input type="checkbox" className="accent-brand-primary" checked={venderAbono} onChange={(e) => setVenderAbono(e.target.checked)} />
          Vender abono (1/3 dos dias de direito)
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground-muted">
          <input type="checkbox" className="accent-brand-primary" checked={adiantar13} onChange={(e) => setAdiantar13(e.target.checked)} />
          Adiantar 1ª parcela do 13º
        </label>

        {erro && (
          <div className="sm:col-span-2">
            <RiskCallout nivel="critico">{erro}</RiskCallout>
          </div>
        )}

        <button
          type="submit"
          disabled={carregando}
          className="sm:col-span-2 rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-brand-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {carregando ? "Calculando..." : "Simular"}
        </button>
      </form>

      {resposta && (
        <div className="space-y-4">
          <MemoriaCalculoTable
            passos={resposta.ferias.memoriaCalculo}
            titulo="Memória de cálculo — Remuneração das férias"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-surface p-4 dark:border-brand-neutral/30">
              <p className="text-xs uppercase text-foreground-muted">Valor líquido estimado (colaborador)</p>
              <p className="text-lg font-semibold text-foreground">{formatarMoeda(resposta.ferias.valor)}</p>
            </div>
            <div className="rounded-lg border border-brand-surface p-4 dark:border-brand-neutral/30">
              <p className="text-xs uppercase text-foreground-muted">Custo total para a empresa</p>
              <p className="text-lg font-semibold text-foreground">{formatarMoeda(resposta.custoTotalEmpresa)}</p>
              <p className="mt-1 text-xs text-foreground-muted">
                Líquido + FGTS ({formatarMoeda(resposta.fgts.valor)})
                {resposta.adiantamento13 > 0 && ` + adiantamento do 13º (${formatarMoeda(resposta.adiantamento13)})`}
              </p>
            </div>
          </div>

          {resposta.adiantamento13 > 0 && (
            <RiskCallout nivel="info">
              Adiantamento do 13º estimado em 50% do salário ({formatarMoeda(resposta.adiantamento13)}),
              sem descontos de INSS/IRRF — retidos normalmente na 2ª parcela, em dezembro.
            </RiskCallout>
          )}
        </div>
      )}
    </div>
  );
}
