"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatarMoeda } from "@/lib/format";
import { Card } from "@/components/shared/Card";
import { Modal } from "@/components/shared/Modal";
import type { EpiParaComprar } from "@/lib/sst/epi";

export interface MesCusto {
  /** "Jan/26" — só a abreviação do mês é exibida. */
  mesLabel: string;
  valor: number;
  qtd: number;
}

const ROTULO_TRIMESTRE = ["jan-fev-mar", "abr-mai-jun", "jul-ago-set", "out-nov-dez"];
/** Uma cor por mês do trimestre, na mesma ordem da lista de valores abaixo da barra. */
const COR_MES = ["bg-brand-primary", "bg-brand-accent", "bg-brand-neutral"];

/**
 * Quatro cartões Q1–Q4 com o gasto do ano corrente. A tarja do cartão é
 * dividida em 3 cores (uma por mês) proporcionais à quantidade de cada mês, e
 * o comprimento total é proporcional ao trimestre de maior quantidade. Se um
 * trimestre tem valor mas nenhuma quantidade (ex.: fatura da clínica sem
 * exames lançados), a tarja usa o valor como proporção.
 */
export function CustoTrimestral({
  titulo,
  unidade,
  meses,
  trimestreAtual,
  comprar,
}: {
  titulo: string;
  unidade: string;
  meses: MesCusto[];
  trimestreAtual: number;
  /** Só no EPI: lista de compra (EPIs vencidos) exibida pelo "!" do trimestre vigente. */
  comprar?: EpiParaComprar[];
}) {
  const [listaAberta, setListaAberta] = useState(false);
  const [epiAberto, setEpiAberto] = useState<string | null>(null);

  const trimestres = [0, 1, 2, 3].map((q) => {
    const doTri = meses.slice(q * 3, q * 3 + 3);
    const qtd = doTri.reduce((acc, m) => acc + m.qtd, 0);
    const valor = doTri.reduce((acc, m) => acc + m.valor, 0);
    const porQtd = qtd > 0;
    const peso = (m: MesCusto) => (porQtd ? m.qtd : m.valor);
    return { q, doTri, qtd, valor, pesoTotal: doTri.reduce((acc, m) => acc + peso(m), 0), peso };
  });
  const maiorPeso = Math.max(1, ...trimestres.map((t) => t.pesoTotal));
  const totalAno = trimestres.reduce((acc, t) => acc + t.valor, 0);
  const qtdAno = trimestres.reduce((acc, t) => acc + t.qtd, 0);
  const totalComprar = (comprar ?? []).reduce((acc, c) => acc + c.colaboradores.length, 0);

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-foreground-muted uppercase">
          {titulo} · por trimestre
        </p>
        <p className="text-[11px] text-foreground-muted">
          {qtdAno} {unidade} · <span className="font-semibold text-foreground">{formatarMoeda(totalAno)}</span>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {trimestres.map((t) => {
          const vigente = t.q === trimestreAtual;
          return (
            <Card key={t.q} className={cn("relative px-4 py-3.5", vigente && "ring-1 ring-brand-primary/40")}>
              <p className="text-[13px] text-foreground-muted">
                <span className="font-bold text-foreground">Q{t.q + 1}</span> {ROTULO_TRIMESTRE[t.q]}
              </p>

              {vigente && comprar && (
                <button
                  type="button"
                  onClick={() => setListaAberta(true)}
                  title={
                    totalComprar > 0
                      ? `${totalComprar} EPI(s) vencido(s) para comprar`
                      : "Nenhum EPI vencido para comprar"
                  }
                  aria-label="EPIs vencidos para comprar"
                  className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-status-warning-bg text-[12px] leading-none font-bold text-status-warning ring-1 ring-status-warning-border transition-transform hover:scale-110"
                >
                  !
                </button>
              )}

              <p className="mt-2 text-[28px] leading-none font-bold text-brand-primary-800">{t.qtd}</p>
              <p className="mt-1 text-[12px] text-foreground-muted">{unidade}</p>

              <div className="mt-2.5 h-2 w-full rounded-full bg-surface-page">
                <div
                  className="flex h-2 overflow-hidden rounded-full"
                  style={{ width: `${(100 * t.pesoTotal) / maiorPeso}%` }}
                >
                  {t.doTri.map((m, i) =>
                    t.peso(m) > 0 ? (
                      <div key={m.mesLabel} className={COR_MES[i]} style={{ flexGrow: t.peso(m), flexBasis: 0 }} />
                    ) : null,
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-1">
                {t.doTri.map((m, i) => (
                  <div key={m.mesLabel} className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-1.5 text-foreground-muted">
                      <span className={cn("h-2 w-2 rounded-full", COR_MES[i])} />
                      {m.mesLabel.split("/")[0]}
                      {m.qtd > 0 && <span className="text-[10.5px]">· {m.qtd}</span>}
                    </span>
                    <span className="font-semibold text-foreground">{formatarMoeda(m.valor)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-hairline pt-1 text-[12px]">
                  <span className="text-foreground-muted">Total do trimestre</span>
                  <span className="font-bold text-brand-primary-800">{formatarMoeda(t.valor)}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {comprar && (
        <Modal
          aberto={listaAberta}
          onFechar={() => {
            setListaAberta(false);
            setEpiAberto(null);
          }}
          eyebrow="EPI"
          titulo="EPIs vencidos para comprar"
          subtitulo="Clique na quantidade para ver quem vai receber."
          largura="34rem"
        >
          {comprar.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-foreground-muted">Nenhum EPI vencido no momento.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {comprar.map((c) => {
                const aberto = epiAberto === c.epi;
                return (
                  <li key={c.epi} className="py-2">
                    <div className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="font-semibold text-foreground">{c.epi}</span>
                      <button
                        type="button"
                        onClick={() => setEpiAberto(aberto ? null : c.epi)}
                        aria-expanded={aberto}
                        className={cn(
                          "min-w-[28px] rounded-full px-2.5 py-0.5 text-[12px] font-bold ring-1 transition-colors",
                          aberto
                            ? "bg-brand-primary text-brand-white ring-brand-primary"
                            : "bg-status-warning-bg text-status-warning ring-status-warning-border hover:bg-brand-primary-100",
                        )}
                      >
                        {c.colaboradores.length}
                      </button>
                    </div>
                    {aberto && (
                      <ul className="mt-1.5 ml-3 space-y-0.5 border-l border-hairline pl-3 text-[12.5px] text-foreground-muted">
                        {c.colaboradores.map((nome) => (
                          <li key={nome}>{nome}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Modal>
      )}
    </section>
  );
}
