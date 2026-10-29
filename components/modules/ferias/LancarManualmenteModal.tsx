"use client";

import { useEffect, useMemo, useState } from "react";
import type { Colaborador } from "@/lib/db/colaboradores";
import type { PeriodoDoHistorico } from "@/lib/db/historicoFerias";
import {
  calcularEstadoPeriodo,
  tetoAbono,
  validarNovoLancamentoCalculado,
} from "@/lib/ferias-gestao/validacoes";
import { useOperador } from "@/lib/currentUser";
import { useSessaoResumo } from "@/lib/authClient";
import { RiskCallout } from "@/components/shared/RiskCallout";
import type { ControleFeriasPj } from "@/lib/db/feriasPj";
import { PjPainel } from "./PjDetalheModal";
import { formatarDataBr } from "@/lib/format";
import { cn } from "@/lib/cn";

const INPUT_CLASS =
  "w-full rounded border border-hairline bg-background px-2 py-1.5 text-[12.5px] text-foreground disabled:cursor-not-allowed disabled:bg-surface-page disabled:text-foreground-muted dark:border-brand-neutral/30";

/** Último dia de gozo = início + dias - 1 (dias corridos). */
function calcularRetorno(inicio: string, dias: number): string | null {
  if (!inicio || !Number.isFinite(dias) || dias <= 0) return null;
  const d = new Date(`${inicio}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function LancarManualmenteModal({
  onFechar,
  onSucesso,
  colaboradorInicialId,
}: {
  onFechar: () => void;
  onSucesso: () => void;
  /** Já abre com este colaborador escolhido (atalho "Programar" da equipe do gestor). */
  colaboradorInicialId?: number | null;
}) {
  const { operador } = useOperador();
  const hojeIso = new Date().toISOString().slice(0, 10);
  const sessao = useSessaoResumo();
  // Gestor comum programa a própria equipe E o próprio período (ele mesmo vem no topo da lista).
  const gestorComum = sessao?.tipo === "gestor" && !sessao.editorColaboradores;
  const meuId =
    gestorComum && sessao.colaboradorId ? sessao.colaboradorId : null;
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [colaboradorId, setColaboradorId] = useState(colaboradorInicialId ? String(colaboradorInicialId) : "");
  const [periodos, setPeriodos] = useState<PeriodoDoHistorico[]>([]);
  const [carregandoPeriodos, setCarregandoPeriodos] = useState(false);
  const [periodoId, setPeriodoId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dias, setDias] = useState("");
  const [abono, setAbono] = useState(false);
  const [adiantamento13, setAdiantamento13] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const ativos = useMemo(
    () =>
      colaboradores
        .filter((c) => c.status !== "desligado" && c.id !== meuId)
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [colaboradores, meuId],
  );

  // PJ não segue a CLT (sem concessivo, fracionamento livre, sem proventos): tem painel próprio.
  const selecionadoPj = colaboradores.find((c) => String(c.id) === colaboradorId)?.vinculo === "PJ";
  const [pjControle, setPjControle] = useState<ControleFeriasPj | null>(null);

  useEffect(() => {
    if (!selecionadoPj) return;
    let cancelado = false;
    fetch(`/api/periodos-aquisitivos/pj?colaboradorId=${colaboradorId}`)
      .then((r) => r.json())
      .then((d: { controle?: ControleFeriasPj | null }) => {
        if (!cancelado) setPjControle(d.controle ?? null);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [selecionadoPj, colaboradorId]);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/colaboradores")
      .then((r) => r.json())
      .then((d: { colaboradores?: Colaborador[] }) => {
        if (!cancelado) setColaboradores(d.colaboradores ?? []);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  // A limpeza ao trocar de colaborador acontece no onChange do select, não
  // aqui — setState síncrono dentro de efeito provoca um render extra.
  useEffect(() => {
    if (!colaboradorId) return;
    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- indicador de carregamento da busca disparada por este efeito
    setCarregandoPeriodos(true);
    fetch(`/api/colaboradores/${colaboradorId}/historico-ferias`)
      .then((r) => r.json())
      .then((d: { periodos?: PeriodoDoHistorico[] }) => {
        if (cancelado) return;
        const lista = d.periodos ?? [];
        setPeriodos(lista);
        // Pré-seleciona o período com saldo mais antigo — é o que corre risco de vencer.
        const comSaldo = lista.filter(
          (p) => p.diasRestantes > 0 && p.status !== "concluido",
        );
        const maisAntigo = comSaldo.sort((a, b) =>
          a.aquisitivoInicio.localeCompare(b.aquisitivoInicio),
        )[0];
        setPeriodoId(maisAntigo ? String(maisAntigo.periodoId) : "");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setCarregandoPeriodos(false);
      });
    return () => {
      cancelado = true;
    };
  }, [colaboradorId]);

  const periodosDisponiveis = periodos.filter(
    (p) => p.diasRestantes > 0 && p.status !== "concluido",
  );
  const periodo =
    periodos.find((p) => String(p.periodoId) === periodoId) ?? null;

  const diasNum = Number(dias);
  // 1/3 dos dias digitados em "Dias de férias": 30 → vende 10, 15 → vende 5.
  const diasAbonoPrevisto =
    abono && Number.isFinite(diasNum) && diasNum > 0 ? tetoAbono(diasNum) : 0;
  const diasGozoPrevisto = diasNum - diasAbonoPrevisto;
  const dataRetorno = periodo
    ? calcularRetorno(dataInicio, diasGozoPrevisto)
    : null;

  /**
   * Mesma função que a API usa para decidir (lib/ferias-gestao/validacoes) —
   * importada, não reescrita, para a mensagem na tela nunca divergir da regra
   * que o servidor aplica de fato. O servidor continua sendo a autoridade.
   */
  const validacao = ((): { ok: true } | { ok: false; erro: string } | null => {
    if (!periodo || !dias) return null;
    if (!Number.isFinite(diasNum) || diasNum <= 0) {
      return {
        ok: false,
        erro: "Informe uma quantidade de dias maior que zero.",
      };
    }
    const info = {
      diasDireito: periodo.diasDireito,
      abonoUtilizado: periodo.abonoUtilizado,
      diasAbono: periodo.diasAbono,
    };
    const estado = calcularEstadoPeriodo(
      info,
      periodo.ferias.map((f) => ({ dias: f.dias })),
    );
    return validarNovoLancamentoCalculado(info, estado, diasNum, abono);
  })();

  const podeLancar =
    Boolean(periodo) &&
    Boolean(dataInicio) &&
    Boolean(dias) &&
    validacao?.ok === true &&
    !enviando;

  async function lancar() {
    if (!periodo) return;
    if (!operador.trim()) {
      setErro(
        "Não foi possível identificar seu usuário — recarregue a página e tente de novo.",
      );
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch(
        `/api/periodos-aquisitivos/${periodo.periodoId}/lancamentos/calculado`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            diasSolicitados: diasNum,
            dataInicioPrevista: dataInicio,
            abonoSolicitado: abono,
            adiantamento13,
            operador,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao lançar a programação.");
        return;
      }
      onSucesso();
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-md border border-hairline bg-background shadow-drawer">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <h3 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
            <span aria-hidden>✍</span> Lançar programação manualmente
          </h3>
          <button
            type="button"
            onClick={onFechar}
            className="text-foreground-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[75vh] space-y-3 overflow-y-auto p-4">
          {
            <label className="block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
              Colaborador
              <select
                value={colaboradorId}
                onChange={(e) => {
                  setColaboradorId(e.target.value);
                  setPeriodos([]);
                  setPeriodoId("");
                  setDias("");
                  setDataInicio("");
                  setAbono(false);
                  setErro(null);
                }}
                className={`mt-1 font-normal normal-case ${INPUT_CLASS}`}
              >
                <option value="">Selecione o colaborador…</option>
                {meuId && (
                  <option value={meuId}>
                    {sessao?.nome} — eu (meu planejamento)
                  </option>
                )}
                {ativos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} — {c.departamento ?? "sem setor"}
                  </option>
                ))}
              </select>
            </label>
          }

          {selecionadoPj && (
            pjControle && String(pjControle.colaboradorId) === colaboradorId ? (
              <PjPainel
                pj={pjControle}
                podeLancar
                onAtualizado={() => {
                  setPjControle(null);
                  onSucesso();
                }}
              />
            ) : (
              <p className="text-[11.5px] text-foreground-muted">Carregando férias do colaborador PJ…</p>
            )
          )}

          {!selecionadoPj && carregandoPeriodos && (
            <p className="text-[11.5px] text-foreground-muted">
              Carregando férias do colaborador…
            </p>
          )}

          {colaboradorId &&
            !selecionadoPj &&
            !carregandoPeriodos &&
            periodosDisponiveis.length === 0 && (
              <RiskCallout nivel="atencao">
                Este colaborador não tem período aquisitivo com dias
                disponíveis. Nada a programar.
              </RiskCallout>
            )}

          {!selecionadoPj && periodosDisponiveis.length > 0 && (
            <label className="block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
              Período aquisitivo
              <select
                value={periodoId}
                onChange={(e) => {
                  setPeriodoId(e.target.value);
                  setDias("");
                  setAbono(false);
                }}
                className={`mt-1 font-normal normal-case ${INPUT_CLASS}`}
              >
                {periodosDisponiveis.map((p) => (
                  <option key={p.periodoId} value={p.periodoId}>
                    {formatarDataBr(p.aquisitivoInicio)} –{" "}
                    {formatarDataBr(p.aquisitivoFim)} · {p.diasRestantes} dia(s)
                    disponível(is)
                    {p.aquisitivoFim.slice(0, 10) > hojeIso ? " (não disponível)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!selecionadoPj && periodo && (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded border border-hairline bg-surface-page px-3 py-2.5">
                <Info
                  rotulo="Período aquisitivo"
                  valor={`${formatarDataBr(periodo.aquisitivoInicio)} – ${formatarDataBr(periodo.aquisitivoFim)}`}
                />
                <Info
                  rotulo="Período concessivo"
                  valor={`${formatarDataBr(periodo.concessivoInicio)} – ${formatarDataBr(periodo.concessivoFim)}`}
                />
                <Info
                  rotulo="Dias de direito"
                  valor={`${periodo.diasDireito}`}
                />
                <Info rotulo="Já gozados" valor={`${periodo.diasGozados}`} />
                <Info
                  rotulo="Disponíveis para tirar"
                  valor={`${periodo.diasRestantes}`}
                  destaque
                />
                <Info
                  rotulo="Períodos já usados"
                  valor={`${periodo.ferias.length} de 3`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
                  Início das férias
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className={`mt-1 font-normal normal-case ${INPUT_CLASS}`}
                  />
                </label>
                <label className="block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
                  Dias de férias
                  <input
                    type="number"
                    min={1}
                    max={periodo.diasRestantes}
                    value={dias}
                    onChange={(e) => setDias(e.target.value)}
                    placeholder={`até ${periodo.diasRestantes}`}
                    className={`mt-1 font-normal normal-case ${INPUT_CLASS}`}
                  />
                </label>
              </div>

              {dataRetorno && validacao?.ok && (
                <p className="text-[11.5px] text-foreground-muted">
                  Último dia de férias em{" "}
                  <strong>
                    {formatarDataBr(
                      calcularRetorno(dataInicio, diasGozoPrevisto - 1)!,
                    )}
                  </strong>{" "}
                  · retorno ao trabalho em{" "}
                  <strong>{formatarDataBr(dataRetorno)}</strong>.
                </p>
              )}

              {!periodo.abonoUtilizado &&
                tetoAbono(periodo.diasRestantes) > 0 && (
                  <div>
                    <label className="flex items-center gap-2 text-[11.5px] text-foreground">
                      <input
                        type="checkbox"
                        checked={abono}
                        onChange={(e) => setAbono(e.target.checked)}
                        className="accent-brand-primary"
                      />
                      Vender abono pecuniário (1/3 dos dias de férias)
                    </label>
                    {abono && diasAbonoPrevisto > 0 && (
                      <p className="mt-1 rounded border border-brand-primary/40 bg-brand-primary-100/50 px-2 py-1.5 text-[11px] text-brand-primary-800">
                        Dos <strong>{diasNum} dias</strong> solicitados, você
                        vai gozar <strong>{diasGozoPrevisto} dias</strong> e
                        vender <strong>{diasAbonoPrevisto} dias</strong> (1/3).
                        Sobram{" "}
                        <strong>
                          {Math.max(0, periodo.diasRestantes - diasNum)} dias
                        </strong>{" "}
                        de férias para gozar neste período.
                      </p>
                    )}
                  </div>
                )}

              <label className="flex items-center gap-2 text-[11.5px] text-foreground">
                <input
                  type="checkbox"
                  checked={adiantamento13}
                  onChange={(e) => setAdiantamento13(e.target.checked)}
                  className="accent-brand-primary"
                />
                Adiantamento do 13º salário junto com as férias
              </label>

              {/* A observação que impede a ação: dias acima do disponível, período
                  abaixo do mínimo legal ou mais de 3 fracionamentos. */}
              {validacao && !validacao.ok && (
                <RiskCallout nivel="critico">{validacao.erro}</RiskCallout>
              )}
            </>
          )}

          {erro && <RiskCallout nivel="critico">{erro}</RiskCallout>}

          {selecionadoPj ? (
            <div className="rounded border border-hairline bg-surface-page px-3 py-2">
              <p className="text-[10px] font-semibold tracking-wide text-brand-primary-800 uppercase">
                Regras aplicadas (PJ)
              </p>
              <ul className="mt-1 list-inside list-disc text-[10.5px] text-foreground-muted">
                <li>Fracionamento livre: sem mínimo de dias, sem limite de períodos.</li>
                <li>A soma não pode passar do saldo; o abatimento é do período aquisitivo mais antigo.</li>
                <li>Sem proventos de férias: valor = mensal ÷ 30 × dias.</li>
              </ul>
            </div>
          ) : (
            <div className="rounded border border-hairline bg-surface-page px-3 py-2">
              <p className="text-[10px] font-semibold tracking-wide text-brand-primary-800 uppercase">
                Regras aplicadas (Art. 134, §1º CLT)
              </p>
              <ul className="mt-1 list-inside list-disc text-[10.5px] text-foreground-muted">
                <li>Cada período precisa ter no mínimo 5 dias.</li>
                <li>No máximo 3 períodos por período aquisitivo.</li>
                <li>A soma não pode passar dos dias disponíveis.</li>
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-hairline px-4 py-3">
          <button
            type="button"
            onClick={onFechar}
            className="rounded border border-hairline px-3 py-1.5 text-[12px] font-medium text-foreground-muted hover:bg-surface-page dark:border-brand-neutral/30"
          >
            {selecionadoPj ? "Fechar" : "Cancelar"}
          </button>
          {!selecionadoPj && (
            <button
              type="button"
              onClick={lancar}
              disabled={!podeLancar}
              className="flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {enviando ? "Lançando..." : "✓ Lançar programação"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div>
      <p className="text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">
        {rotulo}
      </p>
      <p
        className={cn(
          "text-[12px]",
          destaque ? "font-bold text-brand-primary-800" : "text-foreground",
        )}
      >
        {valor}
      </p>
    </div>
  );
}
