"use client";

import { useEffect, useMemo, useState } from "react";
import type { ItemProgramacaoFerias } from "@/lib/db/programacaoFerias";
import type { LancamentoComContexto } from "@/lib/db/lancamentosFerias";
import { detectarConflitos } from "@/lib/ferias-gestao/conflitos";
import { useOperador } from "@/lib/currentUser";
import { Card } from "@/components/shared/Card";
import { RiskCallout } from "@/components/shared/RiskCallout";
import { cn } from "@/lib/cn";
import { formatarDataBr, formatarMoeda } from "@/lib/format";
import { SimuladorFeriasTab } from "./SimuladorFeriasTab";
import { ValidadorCltPanel } from "./ValidadorCltPanel";
import { DetalheCalculoModal } from "./DetalheCalculoModal";
import { LancarProgramacaoModal } from "./LancarProgramacaoModal";
import { LancarManualmenteModal } from "./LancarManualmenteModal";

const FAIXA_TRIMESTRE: Record<1 | 2 | 3 | 4, string> = {
  1: "jan · fev · mar",
  2: "abr · mai · jun",
  3: "jul · ago · set",
  4: "out · nov · dez",
};

function baixado(status: ItemProgramacaoFerias["status"]): boolean {
  return status === "concluida" || status === "alterada";
}

function dataRetornoExibida(item: ItemProgramacaoFerias): string {
  if (item.dataRetorno) return item.dataRetorno;
  const d = new Date(item.dataInicio);
  d.setDate(d.getDate() + item.dias);
  return d.toISOString().slice(0, 10);
}

/** Último dia efetivo de férias — um dia antes do retorno ao trabalho. */
function dataFimGozoExibida(item: ItemProgramacaoFerias): string {
  const d = new Date(dataRetornoExibida(item));
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function PlanejamentoDeFeriasTab({
  simuladorAberto = false,
  ano,
  lancarAberto,
  onFecharLancar,
}: {
  simuladorAberto?: boolean;
  ano: number;
  lancarAberto: boolean;
  onFecharLancar: () => void;
}) {
  const { operador } = useOperador();
  const [itens, setItens] = useState<ItemProgramacaoFerias[]>([]);
  const [lancamentos, setLancamentos] = useState<LancamentoComContexto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [trimestreAtivo, setTrimestreAtivo] = useState<1 | 2 | 3 | 4>(1);
  const [validadorAberto, setValidadorAberto] = useState(false);
  const [itemDetalhe, setItemDetalhe] = useState<ItemProgramacaoFerias | null>(null);
  const [revertendoId, setRevertendoId] = useState<number | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [manualAberto, setManualAberto] = useState(false);
  const [cancelando, setCancelando] = useState<ItemProgramacaoFerias | null>(null);

  async function recarregar() {
    try {
      const [pRes, lRes] = await Promise.all([
        fetch("/api/programacao-ferias"),
        fetch("/api/lancamentos-ferias/ativos"),
      ]);
      const [pData, lData] = await Promise.all([pRes.json(), lRes.json()]);
      setItens(pData.itens ?? []);
      setLancamentos(lData.lancamentos ?? []);
    } finally {
      setCarregando(false);
    }
  }

  async function desfazerBaixa(item: ItemProgramacaoFerias) {
    if (!operador.trim()) {
      setErroAcao("Informe o nome do operador (campo no cabeçalho) antes de continuar.");
      return;
    }
    const confirmou = window.confirm(
      `Desfazer a baixa de ${item.colaboradorNome}? O registro volta para "Confirmar gozo" e sai do total gozado no Controle de Férias.`,
    );
    if (!confirmou) return;

    setErroAcao(null);
    setRevertendoId(item.lancamentoId);
    try {
      const res = await fetch(`/api/lancamentos-ferias/${item.lancamentoId}/reverter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operador }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErroAcao(data.erro ?? "Erro ao desfazer a baixa.");
        return;
      }
      await recarregar();
    } finally {
      setRevertendoId(null);
    }
  }

  /**
   * Cancela a programação. Só vale para lançamento ainda programado: uma vez
   * baixado, o caminho é "Desfazer baixa" e depois cancelar — a API recusa o
   * cancelamento direto de férias já gozadas, e é bom que recuse.
   */
  async function cancelarLancamento(item: ItemProgramacaoFerias, motivo: string) {
    if (!operador.trim()) {
      setErroAcao("Informe o nome do operador (campo no cabeçalho) antes de continuar.");
      return;
    }
    setErroAcao(null);
    try {
      const res = await fetch(`/api/lancamentos-ferias/${item.lancamentoId}/cancelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo, operador }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErroAcao(data.erro ?? "Erro ao cancelar o lançamento.");
        return;
      }
      setCancelando(null);
      await recarregar();
    } catch {
      setErroAcao("Falha de comunicação com o servidor.");
    }
  }

  async function confirmarGozo(item: ItemProgramacaoFerias) {
    if (!operador.trim()) {
      setErroAcao("Informe o nome do operador (campo no cabeçalho) antes de continuar.");
      return;
    }
    setErroAcao(null);
    setConfirmandoId(item.lancamentoId);
    try {
      const res = await fetch(`/api/lancamentos-ferias/${item.lancamentoId}/baixa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataInicioReal: item.dataInicio,
          dataFimReal: dataFimGozoExibida(item),
          dataRetorno: dataRetornoExibida(item),
          diasGozadosReal: item.dias,
          observacaoBaixa: null,
          anexoNome: null,
          operador,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErroAcao(data.erro ?? "Erro ao confirmar gozo.");
        return;
      }
      await recarregar();
    } finally {
      setConfirmandoId(null);
    }
  }

  useEffect(() => {
    void recarregar();
  }, []);

  const itensDoAno = useMemo(() => itens.filter((i) => i.ano === ano), [itens, ano]);

  const porTrimestre = useMemo(() => {
    const grupos = new Map<
      1 | 2 | 3 | 4,
      { itens: ItemProgramacaoFerias[]; dias: number; baixados: number; emAberto: number; colaboradores: Set<number> }
    >([
      [1, { itens: [], dias: 0, baixados: 0, emAberto: 0, colaboradores: new Set() }],
      [2, { itens: [], dias: 0, baixados: 0, emAberto: 0, colaboradores: new Set() }],
      [3, { itens: [], dias: 0, baixados: 0, emAberto: 0, colaboradores: new Set() }],
      [4, { itens: [], dias: 0, baixados: 0, emAberto: 0, colaboradores: new Set() }],
    ]);
    for (const item of itensDoAno) {
      const bucket = grupos.get(item.trimestre)!;
      bucket.itens.push(item);
      bucket.dias += item.dias;
      bucket.colaboradores.add(item.colaboradorId);
      if (baixado(item.status)) bucket.baixados++;
      else bucket.emAberto++;
    }
    for (const bucket of grupos.values()) bucket.itens.sort((a, b) => a.colaboradorNome.localeCompare(b.colaboradorNome));
    return grupos;
  }, [itensDoAno]);

  const conflitos = useMemo(() => detectarConflitos(lancamentos), [lancamentos]);
  const conflitosPorColaborador = useMemo(() => {
    const nomes = new Set<string>();
    for (const c of conflitos) {
      nomes.add(c.colaborador1);
      nomes.add(c.colaborador2);
    }
    return nomes;
  }, [conflitos]);

  const bucketAtivo = porTrimestre.get(trimestreAtivo)!;
  const itensTrimestre = bucketAtivo.itens;
  // Duas somas diferentes de propósito: a coluna mostra o que os colaboradores
  // recebem (líquido do recibo) e o custo da empresa fica no rótulo de apoio,
  // porque são números que não se comparam — um inclui FGTS e INSS patronal.
  const totalColaboradores = itensTrimestre.reduce((soma, i) => soma + (i.semSalario ? 0 : i.detalhe.liquido), 0);
  const custoTotalTrimestre = itensTrimestre.reduce((soma, i) => soma + (i.semSalario ? 0 : i.custoPrevisto), 0);
  const semSalarioTrimestre = itensTrimestre.filter((i) => i.semSalario).length;

  if (carregando) return <p className="text-sm text-foreground-muted">Carregando...</p>;

  return (
    <div className="space-y-5">
      {simuladorAberto && (
        <Card className="p-4">
          <h3 className="mb-3 text-[13.5px] font-bold text-foreground">Simulador de férias</h3>
          <SimuladorFeriasTab />
        </Card>
      )}

      <p className="text-sm text-foreground-muted">
        Programação anual de {ano} por trimestre — o trimestre é o mês em que a férias começa (ou começou).
      </p>

      <Card className="overflow-hidden">
        <button
          type="button"
          onClick={() => setValidadorAberto((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-left"
        >
          <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-foreground">
            <span aria-hidden className="text-status-success">
              ✓
            </span>
            Validador CLT · simular programação
          </span>
          <span className="text-[11px] text-foreground-muted">
            {validadorAberto ? "Recolher ▴" : "Períodos, fracionamento, abono, prazos de aviso e pagamento ▾"}
          </span>
        </button>
        {validadorAberto && (
          <div className="border-t border-hairline p-4">
            <ValidadorCltPanel />
          </div>
        )}
      </Card>

      {conflitos.length > 0 && (
        <RiskCallout nivel="atencao">
          <strong>{conflitos.length}</strong> conflito(s) de agenda entre colaboradores do mesmo departamento —
          destacados abaixo com <span className="font-semibold">⚠</span>.
        </RiskCallout>
      )}

      {erroAcao && <RiskCallout nivel="critico">{erroAcao}</RiskCallout>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([1, 2, 3, 4] as const).map((trimestre) => {
          const bucket = porTrimestre.get(trimestre)!;
          const ativo = trimestreAtivo === trimestre;
          const proporcaoBaixado = bucket.itens.length > 0 ? (bucket.baixados / bucket.itens.length) * 100 : 0;
          return (
            <button
              key={trimestre}
              type="button"
              onClick={() => setTrimestreAtivo(trimestre)}
              className={cn(
                "rounded-lg border p-3.5 text-left transition-shadow hover:shadow-card",
                ativo ? "border-brand-primary/50 bg-brand-primary-050 shadow-card" : "border-hairline bg-background",
              )}
            >
              <div className="flex items-baseline justify-between">
                <span className={cn("text-[13.5px] font-medium", ativo ? "text-brand-primary-800" : "text-foreground")}>
                  Q{trimestre}
                </span>
                <span className={cn("text-[10px]", ativo ? "text-brand-primary-800" : "text-foreground-muted")}>
                  {FAIXA_TRIMESTRE[trimestre]}
                </span>
              </div>
              <div className="mt-2 h-[5px] w-full overflow-hidden rounded-full bg-brand-surface">
                <div
                  className={cn("h-full rounded-full", ativo ? "bg-status-success" : "bg-status-success/60")}
                  style={{ width: `${Math.max(bucket.dias > 0 ? 4 : 0, proporcaoBaixado)}%` }}
                />
              </div>
              <p className={cn("mt-1.5 text-[10px]", ativo ? "text-brand-primary-800" : "text-foreground-muted")}>
                {bucket.dias} dias · {bucket.baixados} concluído(s)
              </p>
              <div className="mt-1.5 flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-status-success">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-status-success" /> Baixados {bucket.baixados}
                </span>
                <span className="flex items-center gap-1 text-foreground-muted">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-status-warning" /> Em aberto {bucket.emAberto}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
          <h3 className="text-sm font-medium text-foreground">
            Programação do {trimestreAtivo}º trimestre{" "}
            <span className="ml-1 rounded-full bg-brand-primary-100 px-2 py-0.5 text-[10.5px] font-bold text-brand-primary-800">
              {bucketAtivo.colaboradores.size} empregado(s)
            </span>
          </h3>
          <div className="flex items-center gap-1.5">
            {([1, 2, 3, 4] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setTrimestreAtivo(q)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  trimestreAtivo === q
                    ? "border-brand-primary bg-brand-primary-100 text-brand-primary-800"
                    : "border-hairline text-foreground-muted hover:bg-surface-page",
                )}
              >
                Q{q}
              </button>
            ))}
            <a
              href={`/api/periodos-aquisitivos/exportar?tipo=trimestre&trimestre=${trimestreAtivo}&ano=${ano}`}
              download
              className="ml-1 flex items-center gap-1 rounded-md border border-hairline px-2.5 py-1 text-[11px] font-semibold text-foreground-muted hover:border-brand-primary hover:text-brand-primary-800 dark:border-brand-neutral/30"
            >
              ↓ Exportar
            </a>
          </div>
        </div>

        {itensTrimestre.length === 0 ? (
          <p className="p-8 text-center text-sm text-foreground-muted">Nenhuma programação neste trimestre.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-[11.5px]">
              <thead>
                <tr className="border-b border-hairline bg-surface-page text-left text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">
                  <th className="px-3 py-2">Colaborador / Setor</th>
                  <th className="px-3 py-2">Admissão</th>
                  <th className="px-3 py-2">Aquisitivo / Concessivo</th>
                  <th className="px-3 py-2">Início → Retorno</th>
                  <th className="px-3 py-2 text-right">Dias</th>
                  <th className="px-3 py-2">Abono</th>
                  <th className="px-3 py-2 text-right" title="Valor líquido que o colaborador recebe. Passe o mouse sobre o valor para ver o custo da empresa.">
                    Valor das férias
                  </th>
                  <th className="px-3 py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {itensTrimestre.map((item) => (
                  <tr key={item.lancamentoId} className="border-b border-hairline/60 last:border-0 hover:bg-surface-page/60">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <MenuLancamento
                          podeCancelar={item.status === "programada"}
                          onDetalhe={() => setItemDetalhe(item)}
                          onCancelar={() => setCancelando(item)}
                        />
                      <button
                        type="button"
                        onClick={() => setItemDetalhe(item)}
                        title="Ver cálculo das férias"
                        className="flex items-center gap-2 text-left hover:text-brand-primary-800"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 truncate font-medium text-foreground uppercase">
                            {item.colaboradorNome}
                            {conflitosPorColaborador.has(item.colaboradorNome) && (
                              <span title="Conflito de agenda com outro colaborador do setor" className="text-status-warning">
                                ⚠
                              </span>
                            )}
                          </div>
                          <div className="truncate text-[10px] text-foreground-muted normal-case">
                            {item.colaboradorCargo ?? "—"} · {item.colaboradorDepartamento ?? "—"}
                          </div>
                        </div>
                      </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-foreground-muted">{formatarDataBr(item.colaboradorAdmissao)}</td>
                    <td className="px-3 py-2 text-[10.5px] text-foreground-muted">
                      {formatarDataBr(item.aquisitivoInicio)} – {formatarDataBr(item.aquisitivoFim)}
                      <br />
                      {formatarDataBr(item.concessivoInicio)} – {formatarDataBr(item.concessivoFim)}
                    </td>
                    <td className="px-3 py-2 text-[10.5px] text-foreground-muted">
                      {formatarDataBr(item.dataInicio)} → {formatarDataBr(dataRetornoExibida(item))}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-foreground">{item.dias}</td>
                    <td className="px-3 py-2 text-foreground-muted">{item.abono ? "Sim" : "Não"}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {item.semSalario ? (
                        <span className="text-status-warning">a confirmar</span>
                      ) : (
                        <span
                          className="cursor-help text-foreground underline decoration-dotted underline-offset-2"
                          title={[
                            `Férias ${item.dias} dia(s): ${formatarMoeda(item.detalhe.valorGozado)}`,
                            `1/3 constitucional: ${formatarMoeda(item.detalhe.tercoConstitucional)}`,
                            item.detalhe.dobra > 0 ? `Dobra Art. 137: ${formatarMoeda(item.detalhe.dobra)}` : null,
                            item.abono ? `Abono: ${formatarMoeda(item.detalhe.abono + item.detalhe.tercoAbono)}` : null,
                            `(–) INSS: ${formatarMoeda(item.detalhe.inss)}`,
                            `(–) IRRF: ${formatarMoeda(item.detalhe.irrf)}`,
                            `= Líquido ao colaborador: ${formatarMoeda(item.detalhe.liquido)}`,
                            "",
                            `FGTS: ${formatarMoeda(item.detalhe.fgts)}`,
                            `INSS patronal: ${formatarMoeda(item.detalhe.inssPatronal)}`,
                            `CUSTO PREVISTO PARA A EMPRESA: ${formatarMoeda(item.custoPrevisto)}`,
                          ]
                            .filter((l) => l !== null)
                            .join("\n")}
                        >
                          {formatarMoeda(item.detalhe.liquido)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {baixado(item.status) ? (
                        <button
                          type="button"
                          title="Clique para desfazer a baixa"
                          disabled={revertendoId === item.lancamentoId}
                          onClick={() => void desfazerBaixa(item)}
                          className="inline-block rounded-full bg-status-success-bg px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap text-status-success transition-opacity hover:opacity-70 disabled:opacity-50"
                        >
                          {revertendoId === item.lancamentoId ? "Desfazendo…" : "Baixado"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={confirmandoId === item.lancamentoId}
                          onClick={() => void confirmarGozo(item)}
                          className="rounded bg-brand-primary px-2.5 py-1 text-[11px] font-medium text-brand-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
                        >
                          {confirmandoId === item.lancamentoId ? "Confirmando..." : "Confirmar gozo"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline bg-surface-page px-4 py-2 text-[10.5px] text-foreground-muted">
          <span>
            Mostrando {itensTrimestre.length} programação(ões) do Q{trimestreAtivo}
          </span>
          <span>
            <span title={`Custo previsto para a empresa (com FGTS e INSS patronal): ${formatarMoeda(custoTotalTrimestre)}`}>
              Colaboradores recebem: <strong>{formatarMoeda(totalColaboradores)}</strong> · custo da empresa:{" "}
              {formatarMoeda(custoTotalTrimestre)}
            </span>
            {semSalarioTrimestre > 0 ? ` · ${semSalarioTrimestre} linha(s) sem salário cadastrado` : ""}
          </span>
        </div>
      </Card>

      {conflitos.length > 0 && (
        <Card className="border-status-danger-border bg-status-danger-bg p-4">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-status-danger">
            <span aria-hidden>▲</span> Conflitos entre setores
          </h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {conflitos.map((c, i) => (
              <div key={i} className="text-[11px] leading-relaxed text-[#51606b]">
                <strong className="text-foreground">{c.departamento}</strong>
                <br />
                {c.colaborador1} · {c.periodo1}
                <br />
                {c.colaborador2} · {c.periodo2}
              </div>
            ))}
          </div>
        </Card>
      )}

      {itemDetalhe && <DetalheCalculoModal item={itemDetalhe} onFechar={() => setItemDetalhe(null)} />}

      {cancelando && (
        <CancelarLancamentoModal
          item={cancelando}
          erro={erroAcao}
          onFechar={() => setCancelando(null)}
          onConfirmar={(motivo) => void cancelarLancamento(cancelando, motivo)}
        />
      )}

      {lancarAberto && (
        <LancarProgramacaoModal
          onFechar={onFecharLancar}
          onLancarManualmente={() => {
            onFecharLancar();
            setManualAberto(true);
          }}
          onSucesso={() => {
            onFecharLancar();
            void recarregar();
          }}
        />
      )}

      {manualAberto && (
        <LancarManualmenteModal
          onFechar={() => setManualAberto(false)}
          onSucesso={() => {
            setManualAberto(false);
            void recarregar();
          }}
        />
      )}
    </div>
  );
}

/**
 * Menu suspenso do ⋮ na lateral do nome. Além do cálculo, oferece o
 * cancelamento do lançamento — só habilitado enquanto ele está apenas
 * programado, porque férias já baixadas precisam antes ter a baixa desfeita.
 */
function MenuLancamento({
  podeCancelar,
  onDetalhe,
  onCancelar,
}: {
  podeCancelar: boolean;
  onDetalhe: () => void;
  onCancelar: () => void;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="Ações do lançamento"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="rounded px-1 leading-none text-foreground-muted hover:bg-brand-surface hover:text-foreground"
      >
        <span aria-hidden>⋮</span>
      </button>

      {aberto && (
        <>
          {/* Camada de fechamento: qualquer clique fora recolhe o menu. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setAberto(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <span className="absolute top-full left-0 z-40 mt-1 flex w-52 flex-col overflow-hidden rounded-md border border-hairline bg-background py-1 shadow-drawer">
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                onDetalhe();
              }}
              className="px-3 py-1.5 text-left text-[12px] font-normal text-foreground normal-case hover:bg-surface-page"
            >
              Ver cálculo das férias
            </button>
            <button
              type="button"
              disabled={!podeCancelar}
              onClick={() => {
                setAberto(false);
                onCancelar();
              }}
              title={podeCancelar ? undefined : "Desfaça a baixa antes de cancelar"}
              className="px-3 py-1.5 text-left text-[12px] font-normal text-red-600 normal-case hover:bg-surface-page disabled:cursor-not-allowed disabled:text-foreground-muted/50 disabled:hover:bg-transparent dark:text-red-400"
            >
              Cancelar lançamento
            </button>
          </span>
        </>
      )}
    </span>
  );
}

/** O motivo é obrigatório: é o que sobra no histórico explicando por que a programação caiu. */
function CancelarLancamentoModal({
  item,
  erro,
  onFechar,
  onConfirmar,
}: {
  item: ItemProgramacaoFerias;
  erro: string | null;
  onFechar: () => void;
  onConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-md border border-hairline bg-background p-4 shadow-drawer">
        <h3 className="text-[13.5px] font-semibold text-foreground">Cancelar lançamento</h3>
        <p className="mt-1 text-[11.5px] text-foreground-muted">
          {item.colaboradorNome} · {item.dias} dia(s) a partir de {formatarDataBr(item.dataInicio)}. Os dias voltam para
          o saldo do período aquisitivo.
        </p>

        <label className="mt-3 block text-[11px] font-semibold tracking-wide text-foreground-muted uppercase">
          Motivo do cancelamento
        </label>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-brand-surface bg-background px-3 py-2 text-sm text-foreground dark:border-brand-neutral/30"
        />

        {erro && <p className="mt-2 text-[11.5px] text-status-danger">{erro}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-md border border-brand-surface px-4 py-2 text-sm text-foreground-muted hover:bg-brand-surface dark:border-brand-neutral/30"
          >
            Voltar
          </button>
          <button
            type="button"
            disabled={!motivo.trim()}
            onClick={() => onConfirmar(motivo)}
            className="rounded-md bg-status-danger px-4 py-2 text-sm font-medium text-brand-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            Confirmar cancelamento
          </button>
        </div>
      </div>
    </div>
  );
}
