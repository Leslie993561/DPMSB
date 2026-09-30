"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatarMoeda } from "@/lib/format";
import { BlocoTrimestres, type TrimestreValor } from "./BlocoTrimestres";

interface DadosSst {
  kpi: { asoEmDia: number; aVencer: number; pendencias: number };
  pctEmDia: number;
  fichasEpi: { total: number; assinadas: number; aguardando: number; semFicha: number };
  custoMensalEpiExames: { mes: string; epi: number; exames: number }[];
}

/**
 * Resumo do Portal SST na home — mesmo padrão do Portal DP: busca no Dashboard
 * SST de verdade, então os números batem com o que o módulo mostra. Falha da
 * API (gestor sem acesso ao SST) só zera o cartão, não quebra a home.
 */
export function PortalSstResumo() {
  const ano = new Date().getFullYear();
  const [dados, setDados] = useState<DadosSst | null>(null);

  useEffect(() => {
    fetch("/api/sst/dashboard")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: DadosSst) => setDados(d))
      .catch(() => setDados(null));
  }, []);

  const custoPorTrimestre: TrimestreValor[] | null = dados
    ? ([1, 2, 3, 4] as const).map((q) => {
        const mesesDoTrimestre = dados.custoMensalEpiExames.slice((q - 1) * 3, q * 3);
        const epi = mesesDoTrimestre.reduce((acc, m) => acc + m.epi, 0);
        const exames = mesesDoTrimestre.reduce((acc, m) => acc + m.exames, 0);
        return { trimestre: q, valor: epi + exames, detalhe: `EPI ${formatarMoeda(epi)} · Exames ${formatarMoeda(exames)}` };
      })
    : null;

  return (
    <section className="w-full rounded-xl border border-brand-surface bg-background p-5 dark:border-brand-neutral/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-foreground">Portal SST</h2>
          <p className="mt-0.5 text-sm text-foreground-muted">Segurança e Saúde no Trabalho: EPI, exames, fardamento e acessos.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-bold tracking-wide text-foreground-muted uppercase">Fichas assinadas</p>
            <p className="text-2xl font-bold text-brand-primary-800">{dados ? dados.fichasEpi.assinadas : "—"}</p>
          </div>
          <Link
            href="/sst"
            className="rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover"
          >
            Abrir →
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <BlocoTrimestres titulo={`Custo EPI + Exames · ${ano}`} href="/sst" dados={custoPorTrimestre} />

        <div className="rounded-lg border border-hairline p-3">
          <Link href="/sst/epi" className="text-[11px] font-bold tracking-wide text-foreground-muted uppercase hover:text-brand-primary-800">
            Fichas de EPI
          </Link>
          <div className="mt-2 flex flex-col divide-y divide-hairline/60">
            {!dados ? (
              <p className="py-2 text-[11.5px] text-foreground-muted">Carregando...</p>
            ) : (
              <>
                <LinhaEstatistica rotulo="Assinadas" valor={dados.fichasEpi.assinadas} tone="success" />
                <LinhaEstatistica rotulo="Aguardando assinatura" valor={dados.fichasEpi.aguardando} tone="warning" />
                <LinhaEstatistica rotulo="Entregas sem ficha ainda" valor={dados.fichasEpi.semFicha} tone="danger" />
              </>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-hairline p-3">
          <Link
            href="/sst/exames"
            className="text-[11px] font-bold tracking-wide text-foreground-muted uppercase hover:text-brand-primary-800"
          >
            Exames Ocupacionais
          </Link>
          <div className="mt-2 flex flex-col divide-y divide-hairline/60">
            {!dados ? (
              <p className="py-2 text-[11.5px] text-foreground-muted">Carregando...</p>
            ) : (
              <>
                <LinhaEstatistica rotulo="Em dia" valor={`${dados.pctEmDia}%`} tone="success" />
                <LinhaEstatistica rotulo="A vencer (60 dias)" valor={dados.kpi.aVencer} tone="warning" />
                <LinhaEstatistica rotulo="Vencidos + revisão" valor={dados.kpi.pendencias} tone="danger" />
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function LinhaEstatistica({ rotulo, valor, tone }: { rotulo: string; valor: number | string; tone: "success" | "warning" | "danger" }) {
  const cor = tone === "success" ? "text-status-success" : tone === "warning" ? "text-status-warning" : "text-status-danger";
  return (
    <div className="flex items-baseline justify-between gap-2 py-1.5">
      <p className="text-[12px] font-medium text-foreground">{rotulo}</p>
      <p className={`text-[13px] font-semibold ${cor}`}>{valor}</p>
    </div>
  );
}
