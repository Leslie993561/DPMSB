"use client";

import { useEffect, useState } from "react";
import type { PeriodoAquisitivoAberto } from "@/lib/db/periodosAquisitivos";
import type { StatusLancamento } from "@/lib/db/lancamentosFerias";
import type { PeriodoDoHistorico } from "@/lib/db/historicoFerias";
import { useOperador } from "@/lib/currentUser";
import { RiskCallout } from "@/components/shared/RiskCallout";
import { Badge, type CorBadge } from "@/components/shared/Badge";
import { Modal } from "@/components/shared/Modal";
import { formatarDataBr } from "@/lib/format";
import { cn } from "@/lib/cn";

const INPUT_CLASS =
  "w-full rounded-md border border-brand-surface bg-background px-3 py-2 text-sm text-foreground dark:border-brand-neutral/30";

const ROTULO_STATUS: Record<StatusLancamento, { label: string; cor: CorBadge }> = {
  programada: { label: "Programada", cor: "azul" },
  concluida: { label: "Concluída", cor: "verde" },
  cancelada: { label: "Cancelada", cor: "neutro" },
  alterada: { label: "Alterada", cor: "amarelo" },
};

type Modo = "lista" | "programar" | { tipo: "baixa" | "cancelar"; lancamentoId: number };

export function PeriodoDetalheModal({
  periodo,
  onFechar,
  onAtualizado,
}: {
  periodo: PeriodoAquisitivoAberto;
  onFechar: () => void;
  onAtualizado: () => void;
}) {
  const { operador } = useOperador();
  const [historico, setHistorico] = useState<PeriodoDoHistorico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modo, setModo] = useState<Modo>("lista");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  /** Histórico do COLABORADOR (todos os períodos), não só do período clicado. */
  async function recarregarLancamentos() {
    const res = await fetch(`/api/colaboradores/${periodo.colaboradorId}/historico-ferias`);
    const data = await res.json();
    setHistorico(data.periodos ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca de dados ao montar/trocar de período; setState só ocorre após o await do fetch
    void recarregarLancamentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só depende do colaborador, que não muda enquanto o modal está aberto
  }, [periodo.colaboradorId]);

  function exigirOperador(): boolean {
    if (!operador.trim()) {
      setErro("Informe o nome do operador (campo no cabeçalho) antes de continuar.");
      return false;
    }
    return true;
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      eyebrow="Histórico de férias"
      titulo={periodo.colaboradorNome}
      subtitulo={`Aquisitivo ${formatarDataBr(periodo.dataInicio)} a ${formatarDataBr(periodo.dataFim)} · ${periodo.diasSemLancamento} dia(s) livre(s) para programar · ${periodo.fracionamentos}/3 fracionamentos usados`}
      largura="52rem"
      rodape={
        <>
          <span className="text-xs text-foreground-muted">Colaborador · {periodo.colaboradorDepartamento ?? "—"}</span>
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
      <div className="space-y-4">
        {periodo.riscoDobro && (
          <RiskCallout nivel="critico">
            Risco de pagamento em dobro (Art. 137 CLT) — o período já venceu ou a data de início prevista
            é posterior ao limite de concessão ({formatarDataBr(periodo.concessivoFim)}).
          </RiskCallout>
        )}

        {erro && <RiskCallout nivel="critico">{erro}</RiskCallout>}

        {carregando ? (
          <p className="text-sm text-foreground-muted">Carregando histórico...</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-brand-surface dark:border-brand-neutral/30">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-brand-surface text-left text-[10.5px] font-semibold tracking-wide text-foreground-muted uppercase dark:border-brand-neutral/30">
                  <th className="px-3 py-2">Período aquisitivo</th>
                  <th className="px-3 py-2">Período concessivo</th>
                  <th className="px-3 py-2">Período de férias</th>
                  <th className="px-3 py-2 text-right">Dias</th>
                  <th className="px-3 py-2">Situação</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {historico.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-center text-foreground-muted">
                      Nenhum período aquisitivo cadastrado.
                    </td>
                  </tr>
                ) : (
                  historico.flatMap((per) => {
                    const aquisitivo = `${formatarDataBr(per.aquisitivoInicio)} – ${formatarDataBr(per.aquisitivoFim)}`;
                    const concessivo = `${formatarDataBr(per.concessivoInicio)} – ${formatarDataBr(per.concessivoFim)}`;
                    const destaque = per.periodoId === periodo.id;

                    // Período sem nenhuma férias lançada ainda: uma linha só, para
                    // o aquisitivo/concessivo aparecerem mesmo sem gozo.
                    if (per.ferias.length === 0) {
                      return [
                        <tr
                          key={`p${per.periodoId}`}
                          className={cn(
                            "border-b border-brand-surface/60 last:border-0 dark:border-brand-neutral/20",
                            destaque && "bg-brand-primary-100/40",
                          )}
                        >
                          <td className="px-3 py-2 whitespace-nowrap text-foreground">{aquisitivo}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-foreground-muted">{concessivo}</td>
                          <td className="px-3 py-2 text-foreground-muted">—</td>
                          <td className="px-3 py-2 text-right text-foreground-muted">—</td>
                          <td className="px-3 py-2">
                            <Badge cor="neutro">Sem gozo</Badge>
                          </td>
                          <td className="px-3 py-2" />
                        </tr>,
                      ];
                    }

                    return per.ferias.map((f, i) => (
                      <tr
                        key={f.lancamentoId}
                        className={cn(
                          "border-b border-brand-surface/60 last:border-0 dark:border-brand-neutral/20",
                          destaque && "bg-brand-primary-100/40",
                        )}
                      >
                        {/* Aquisitivo/concessivo só na primeira linha do período, para não repetir a mesma data em cada gozo */}
                        <td className="px-3 py-2 whitespace-nowrap text-foreground">{i === 0 ? aquisitivo : ""}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-foreground-muted">
                          {i === 0 ? concessivo : ""}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-foreground">
                          {f.inicio ? formatarDataBr(f.inicio) : "—"}
                          {f.fim ? ` – ${formatarDataBr(f.fim)}` : ""}
                          {f.abonoInicio && (
                            <span className="block text-[10px] text-foreground-muted">
                              abono {formatarDataBr(f.abonoInicio)}
                              {f.abonoFim ? ` – ${formatarDataBr(f.abonoFim)}` : ""}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-foreground">
                          {f.dias}
                          {f.diasAbono > 0 && (
                            <span className="block text-[10px] text-foreground-muted">+{f.diasAbono} abono</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge cor={ROTULO_STATUS[f.status].cor}>{ROTULO_STATUS[f.status].label}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {f.status === "programada" && (
                            <>
                              <button
                                type="button"
                                onClick={() => setModo({ tipo: "baixa", lancamentoId: f.lancamentoId })}
                                className="mr-2 text-xs font-medium text-brand-primary hover:underline"
                              >
                                Dar baixa
                              </button>
                              <button
                                type="button"
                                onClick={() => setModo({ tipo: "cancelar", lancamentoId: f.lancamentoId })}
                                className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ));
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {modo === "lista" && periodo.diasSemLancamento > 0 && (
          <button
            type="button"
            onClick={() => setModo("programar")}
            className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-brand-white transition-colors hover:bg-brand-primary-hover"
          >
            Programar férias
          </button>
        )}

        {modo === "programar" && (
          <FormularioProgramar
            periodo={periodo}
            operador={operador}
            exigirOperador={exigirOperador}
            enviando={enviando}
            setEnviando={setEnviando}
            setErro={setErro}
            onSucesso={() => {
              setModo("lista");
              void recarregarLancamentos();
              onAtualizado();
            }}
            onCancelar={() => setModo("lista")}
          />
        )}

        {typeof modo === "object" && modo.tipo === "baixa" && (
          <FormularioBaixa
            lancamentoId={modo.lancamentoId}
            operador={operador}
            exigirOperador={exigirOperador}
            enviando={enviando}
            setEnviando={setEnviando}
            setErro={setErro}
            onSucesso={() => {
              setModo("lista");
              void recarregarLancamentos();
              onAtualizado();
            }}
            onCancelar={() => setModo("lista")}
          />
        )}

        {typeof modo === "object" && modo.tipo === "cancelar" && (
          <FormularioCancelar
            lancamentoId={modo.lancamentoId}
            operador={operador}
            exigirOperador={exigirOperador}
            enviando={enviando}
            setEnviando={setEnviando}
            setErro={setErro}
            onSucesso={() => {
              setModo("lista");
              void recarregarLancamentos();
              onAtualizado();
            }}
            onCancelar={() => setModo("lista")}
          />
        )}
      </div>
    </Modal>
  );
}

interface SubFormProps {
  operador: string;
  exigirOperador: () => boolean;
  enviando: boolean;
  setEnviando: (v: boolean) => void;
  setErro: (v: string | null) => void;
  onSucesso: () => void;
  onCancelar: () => void;
}

function FormularioProgramar({
  periodo,
  operador,
  exigirOperador,
  enviando,
  setEnviando,
  setErro,
  onSucesso,
  onCancelar,
}: SubFormProps & { periodo: PeriodoAquisitivoAberto }) {
  const [dias, setDias] = useState("14");
  const [dataInicio, setDataInicio] = useState("");
  const [abono, setAbono] = useState(false);

  async function confirmar() {
    if (!exigirOperador()) return;
    if (!dataInicio) {
      setErro("Informe a data de início prevista.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch(`/api/periodos-aquisitivos/${periodo.id}/lancamentos/calculado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diasSolicitados: Number(dias),
          dataInicioPrevista: dataInicio,
          abonoSolicitado: abono,
          operador,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao programar férias.");
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
    <div className="space-y-3 rounded-lg border border-brand-surface p-4 dark:border-brand-neutral/30">
      <h3 className="text-sm font-medium text-foreground">Programar férias</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-foreground-muted">
          Dias solicitados
          <input type="number" min={1} max={30} value={dias} onChange={(e) => setDias(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground-muted">
          Data de início prevista
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className={INPUT_CLASS} />
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm text-foreground-muted">
        <input
          type="checkbox"
          className="mt-0.5 accent-brand-primary"
          checked={abono}
          disabled={periodo.abonoUtilizado}
          onChange={(e) => setAbono(e.target.checked)}
        />
        <span>
          Solicitar abono pecuniário
          {periodo.abonoUtilizado && (
            <span className="block text-xs text-brand-neutral">Já utilizado neste período aquisitivo.</span>
          )}
        </span>
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="rounded-md border border-brand-surface px-4 py-2 text-sm text-foreground-muted hover:bg-brand-surface dark:border-brand-neutral/30">
          Cancelar
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={enviando}
          className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {enviando ? "Enviando..." : "Confirmar"}
        </button>
      </div>
    </div>
  );
}

function FormularioBaixa({
  lancamentoId,
  operador,
  exigirOperador,
  enviando,
  setEnviando,
  setErro,
  onSucesso,
  onCancelar,
}: SubFormProps & { lancamentoId: number }) {
  const [dataInicioReal, setDataInicioReal] = useState("");
  const [dataFimReal, setDataFimReal] = useState("");
  const [dataRetorno, setDataRetorno] = useState("");
  const [diasReal, setDiasReal] = useState("");
  const [observacao, setObservacao] = useState("");
  const [anexoNome, setAnexoNome] = useState<string | null>(null);

  async function confirmar() {
    if (!exigirOperador()) return;
    if (!dataInicioReal || !dataFimReal || !dataRetorno || !diasReal) {
      setErro("Preencha todas as datas e os dias gozados.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch(`/api/lancamentos-ferias/${lancamentoId}/baixa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataInicioReal,
          dataFimReal,
          dataRetorno,
          diasGozadosReal: Number(diasReal),
          observacaoBaixa: observacao || null,
          anexoNome,
          operador,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao dar baixa.");
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
    <div className="space-y-3 rounded-lg border border-brand-surface p-4 dark:border-brand-neutral/30">
      <h3 className="text-sm font-medium text-foreground">Dar baixa nas férias</h3>
      <p className="text-xs text-foreground-muted">
        Só confirme quando as férias tiverem sido efetivamente concedidas (ou anexe o comprovante).
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-foreground-muted">
          Início real
          <input type="date" value={dataInicioReal} onChange={(e) => setDataInicioReal(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground-muted">
          Fim real
          <input type="date" value={dataFimReal} onChange={(e) => setDataFimReal(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground-muted">
          Retorno
          <input type="date" value={dataRetorno} onChange={(e) => setDataRetorno(e.target.value)} className={INPUT_CLASS} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm text-foreground-muted">
        Dias efetivamente gozados
        <input type="number" min={1} value={diasReal} onChange={(e) => setDiasReal(e.target.value)} className={INPUT_CLASS} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-foreground-muted">
        Observação (opcional)
        <input value={observacao} onChange={(e) => setObservacao(e.target.value)} className={INPUT_CLASS} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-foreground-muted">
        Anexar documentação (opcional — apenas o nome do arquivo é registrado nesta versão)
        <input
          type="file"
          onChange={(e) => setAnexoNome(e.target.files?.[0]?.name ?? null)}
          className="w-full rounded-md border border-brand-surface bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-brand-primary file:px-3 file:py-1 file:text-brand-white dark:border-brand-neutral/30"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="rounded-md border border-brand-surface px-4 py-2 text-sm text-foreground-muted hover:bg-brand-surface dark:border-brand-neutral/30">
          Voltar
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={enviando}
          className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {enviando ? "Confirmando..." : "Confirmar baixa"}
        </button>
      </div>
    </div>
  );
}

function FormularioCancelar({
  lancamentoId,
  operador,
  exigirOperador,
  enviando,
  setEnviando,
  setErro,
  onSucesso,
  onCancelar,
}: SubFormProps & { lancamentoId: number }) {
  const [motivo, setMotivo] = useState("");

  async function confirmar() {
    if (!exigirOperador()) return;
    if (!motivo.trim()) {
      setErro("Informe o motivo do cancelamento.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch(`/api/lancamentos-ferias/${lancamentoId}/cancelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo, operador }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao cancelar.");
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
    <div className="space-y-3 rounded-lg border border-brand-surface p-4 dark:border-brand-neutral/30">
      <h3 className="text-sm font-medium text-foreground">Cancelar programação</h3>
      <label className="flex flex-col gap-1 text-sm text-foreground-muted">
        Motivo
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className={INPUT_CLASS} />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="rounded-md border border-brand-surface px-4 py-2 text-sm text-foreground-muted hover:bg-brand-surface dark:border-brand-neutral/30">
          Voltar
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={enviando}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {enviando ? "Cancelando..." : "Confirmar cancelamento"}
        </button>
      </div>
    </div>
  );
}
