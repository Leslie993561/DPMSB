"use client";

import { useState } from "react";
import type { ControleFeriasPj } from "@/lib/db/feriasPj";
import { valorFeriasPj } from "@/lib/ferias-pj/calc";
import { formatarDataBr, formatarMoeda } from "@/lib/format";
import { useOperador } from "@/lib/currentUser";
import { Modal } from "@/components/shared/Modal";

const INPUT_CLASS =
  "w-full rounded-md border border-brand-surface bg-background px-2.5 py-1.5 text-xs text-foreground dark:border-brand-neutral/30";

/**
 * Detalhe de férias de um colaborador PJ: saldo de cada período aquisitivo
 * separado, lançamento livre (só exige caber no saldo) e valor das férias —
 * apenas valor mensal ÷ 30 × dias, sem nenhum provento de CLT.
 */
/** Conteúdo do detalhe PJ (saldo por período, lançamento e férias lançadas) — usado no modal do Controle e no "Lançar programação manualmente". */
export function PjPainel({
  pj,
  podeLancar,
  onAtualizado,
}: {
  pj: ControleFeriasPj;
  podeLancar: boolean;
  onAtualizado: () => void;
}) {
  const { operador } = useOperador();
  const [dias, setDias] = useState("");
  const [inicio, setInicio] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const diasNum = Number(dias);
  const diasValidos = Number.isInteger(diasNum) && diasNum > 0;
  const cabeNoSaldo = diasValidos && diasNum <= pj.saldoTotal;
  // Último dia de gozo = início + dias − 1 (dias corridos), como no lançamento CLT.
  const fim = inicio && diasValidos ? ultimoDia(inicio, diasNum) : "";
  const pronto = cabeNoSaldo && Boolean(inicio) && Boolean(fim) && !enviando;

  async function lancar() {
    if (!operador.trim()) {
      setErro("Não foi possível identificar seu usuário — recarregue a página e tente de novo.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/periodos-aquisitivos/pj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colaboradorId: pj.colaboradorId,
          dias: diasNum,
          dataInicioGozo: inicio,
          dataFimGozo: fim,
          observacao: observacao.trim() || null,
          operador,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao lançar as férias.");
        return;
      }
      onAtualizado();
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-foreground-muted uppercase">
            Saldo por período aquisitivo
          </h3>
          {pj.periodos.length === 0 ? (
            <p className="text-sm text-foreground-muted">
              Ainda não completou 12 meses de contrato — saldo 0. O primeiro período fecha em{" "}
              {formatarDataBr(proximoAniversario(pj.colaboradorAdmissao))}.
            </p>
          ) : (
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="border-b border-hairline text-left text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">
                  <th className="px-2 py-1.5">Aquisitivo</th>
                  <th className="px-2 py-1.5 text-right">Direito</th>
                  <th className="px-2 py-1.5 text-right">Gozado</th>
                  <th className="px-2 py-1.5 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {pj.periodos.map((p) => (
                  <tr key={p.inicio} className="border-b border-hairline/60 last:border-0">
                    <td className="px-2 py-1.5 text-foreground-muted">
                      {formatarDataBr(p.inicio)} – {formatarDataBr(p.fim)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-foreground-muted">{p.direito}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-status-success">{p.gozado}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-foreground">{p.saldo}</td>
                  </tr>
                ))}
                <tr>
                  <td className="px-2 py-1.5 font-semibold text-foreground" colSpan={3}>
                    Saldo total
                  </td>
                  <td className="px-2 py-1.5 text-right font-bold text-foreground">{pj.saldoTotal}</td>
                </tr>
              </tbody>
            </table>
          )}
        </section>

        {podeLancar && (
          <section className="rounded-md border border-hairline p-3">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-foreground-muted uppercase">Lançar férias</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-[11px] font-semibold text-foreground-muted">
                Dias
                <input
                  type="number"
                  min={1}
                  max={pj.saldoTotal}
                  value={dias}
                  onChange={(e) => setDias(e.target.value)}
                  className={`mt-1 font-normal ${INPUT_CLASS}`}
                />
              </label>
              <label className="text-[11px] font-semibold text-foreground-muted">
                Início do gozo
                <input
                  type="date"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  className={`mt-1 font-normal ${INPUT_CLASS}`}
                />
              </label>
              <div className="text-[11px] font-semibold text-foreground-muted">
                Último dia de gozo
                <p className="mt-1 rounded-md border border-hairline bg-surface-page px-2.5 py-1.5 text-xs font-normal text-foreground">
                  {fim ? formatarDataBr(fim) : "—"}
                </p>
              </div>
            </div>
            <label className="mt-3 block text-[11px] font-semibold text-foreground-muted">
              Observação (opcional)
              <input value={observacao} onChange={(e) => setObservacao(e.target.value)} className={`mt-1 font-normal ${INPUT_CLASS}`} />
            </label>

            {diasValidos && (
              <p className="mt-3 text-xs text-foreground-muted">
                Valor das férias:{" "}
                <strong className="text-foreground">{formatarMoeda(valorFeriasPj(pj.valorMensal, diasNum))}</strong>{" "}
                ({formatarMoeda(pj.valorMensal)} ÷ 30 × {diasNum} dias)
              </p>
            )}
            {diasValidos && !cabeNoSaldo && (
              <p className="mt-2 text-xs text-status-danger">
                Saldo insuficiente: {pj.saldoTotal} dia(s) disponíveis.
              </p>
            )}
            {erro && <p className="mt-2 text-xs text-status-danger">{erro}</p>}

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={!pronto}
                onClick={() => void lancar()}
                className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {enviando ? "Lançando..." : "Lançar férias"}
              </button>
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-foreground-muted uppercase">Férias lançadas</h3>
          {pj.lancamentos.length === 0 ? (
            <p className="text-sm text-foreground-muted">Nenhuma férias lançada.</p>
          ) : (
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="border-b border-hairline text-left text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">
                  <th className="px-2 py-1.5">Gozo</th>
                  <th className="px-2 py-1.5 text-right">Dias</th>
                  <th className="px-2 py-1.5 text-right">Valor das férias</th>
                </tr>
              </thead>
              <tbody>
                {pj.lancamentos.map((l) => (
                  <tr key={l.id} className="border-b border-hairline/60 last:border-0">
                    <td className="px-2 py-1.5 text-foreground-muted">
                      {l.dataInicio ? formatarDataBr(l.dataInicio) : "—"} – {l.dataFim ? formatarDataBr(l.dataFim) : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right text-foreground-muted">{l.dias}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-foreground">{formatarMoeda(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
  );
}

interface LinhaHistoricoPj {
  chave: string;
  aquisitivoInicio: string;
  aquisitivoFim: string;
  concessivoInicio: string;
  concessivoFim: string;
  gozoInicio: string | null;
  gozoFim: string | null;
  dias: number;
}

function somarAnos(iso: string, anos: number): string {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  const alvo = new Date(Date.UTC(a + anos, m - 1, 1));
  alvo.setUTCDate(Math.min(d, new Date(Date.UTC(a + anos, m, 0)).getUTCDate()));
  return alvo.toISOString().slice(0, 10);
}

/**
 * Uma linha por período aquisitivo e por férias gozadas nele. Os dias gozados
 * saem do período mais antigo primeiro (mesma regra do saldo); o concessivo é só
 * informativo, como na CLT — para PJ nada vence.
 */
function montarHistorico(pj: ControleFeriasPj): LinhaHistoricoPj[] {
  const restante = pj.periodos.map(() => 30);
  const gozos = pj.periodos.map(() => [] as LinhaHistoricoPj[]);
  const base = (i: number) => ({
    aquisitivoInicio: pj.periodos[i].inicio,
    aquisitivoFim: pj.periodos[i].fim,
    concessivoInicio: pj.periodos[i].fim,
    concessivoFim: somarAnos(pj.periodos[i].fim, 1),
  });

  for (const l of pj.lancamentos) {
    let falta = l.dias;
    for (let i = 0; i < pj.periodos.length && falta > 0; i++) {
      const parte = Math.min(restante[i], falta);
      if (parte <= 0) continue;
      restante[i] -= parte;
      falta -= parte;
      gozos[i].push({
        chave: `${pj.periodos[i].inicio}-${l.id}`,
        ...base(i),
        gozoInicio: l.dataInicio,
        gozoFim: l.dataFim,
        dias: parte,
      });
    }
  }

  return pj.periodos
    .flatMap((p, i) =>
      gozos[i].length > 0
        ? gozos[i]
        : [{ chave: p.inicio, ...base(i), gozoInicio: null, gozoFim: null, dias: 0 }],
    )
    .reverse();
}

/** Histórico de férias de um PJ, no formato do histórico da CLT: aquisitivo, concessivo (informativo), período de férias e dias gozados. */
export function PjDetalheModal({ pj, onFechar }: { pj: ControleFeriasPj; onFechar: () => void }) {
  const linhas = montarHistorico(pj);
  return (
    <Modal
      aberto
      onFechar={onFechar}
      eyebrow="Histórico de férias"
      titulo={pj.colaboradorNome}
      subtitulo={`Colaborador PJ · contrato desde ${formatarDataBr(pj.colaboradorAdmissao)} · saldo ${pj.saldoTotal} dia(s)`}
      largura="52rem"
      rodape={
        <>
          <span className="text-xs text-foreground-muted">Colaborador PJ · {pj.colaboradorDepartamento ?? "—"}</span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onFechar}
            className="rounded-md border border-brand-surface px-4 py-2 text-sm text-foreground-muted hover:bg-brand-surface dark:border-brand-neutral/30"
          >
            Fechar
          </button>
        </>
      }
    >
      {linhas.length === 0 ? (
        <p className="text-sm text-foreground-muted">
          Ainda não completou 12 meses de contrato — nenhum período aquisitivo fechado. O primeiro fecha em{" "}
          {formatarDataBr(proximoAniversario(pj.colaboradorAdmissao))}.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-hairline">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-hairline bg-surface-page text-left text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
                <th className="px-3 py-2">Período aquisitivo</th>
                <th className="px-3 py-2">Período concessivo</th>
                <th className="px-3 py-2">Período de férias</th>
                <th className="px-3 py-2 text-right">Dias gozados</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.chave} className="border-b border-hairline/60 last:border-0">
                  <td className="px-3 py-2.5 text-foreground">
                    {formatarDataBr(l.aquisitivoInicio)} – {formatarDataBr(l.aquisitivoFim)}
                  </td>
                  <td className="px-3 py-2.5 text-foreground-muted">
                    {formatarDataBr(l.concessivoInicio)} – {formatarDataBr(l.concessivoFim)}
                  </td>
                  <td className="px-3 py-2.5 text-foreground-muted">
                    {l.gozoInicio ? `${formatarDataBr(l.gozoInicio)} – ${l.gozoFim ? formatarDataBr(l.gozoFim) : "—"}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-foreground">{l.dias > 0 ? l.dias : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

/** Último dia de gozo: início + dias − 1, em dias corridos. */
function ultimoDia(inicio: string, dias: number): string {
  const d = new Date(`${inicio}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias - 1);
  return d.toISOString().slice(0, 10);
}

/** Data em que o primeiro período aquisitivo fecha (12 meses depois do início do contrato). */
function proximoAniversario(inicio: string): string {
  const [a, m, d] = inicio.slice(0, 10).split("-").map(Number);
  const alvo = new Date(Date.UTC(a + 1, m - 1, 1));
  const ultimo = new Date(Date.UTC(a + 1, m, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}
