"use client";

import { useEffect, useMemo, useState } from "react";
import type { Colaborador } from "@/lib/db/colaboradores";
import { Card } from "@/components/shared/Card";
import { formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/cn";

const INPUT =
  "w-full rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[12.5px] text-foreground dark:border-brand-neutral/30";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const HOJE = new Date();
const ANOS = [HOJE.getFullYear() - 1, HOJE.getFullYear(), HOJE.getFullYear() + 1];

/**
 * Dias do mês separados entre úteis e de repouso, contando só os domingos —
 * a base do DSR (Lei 605/1949). FERIADOS NÃO ENTRAM: o portal não tem
 * calendário de feriados, e chutar um número seria pior do que deixar o campo
 * editável para o DP ajustar com o calendário real da empresa.
 */
function diasDoMes(ano: number, mes: number): { uteis: number; repouso: number } {
  const total = new Date(ano, mes, 0).getDate();
  let repouso = 0;
  for (let d = 1; d <= total; d++) {
    if (new Date(ano, mes - 1, d).getDay() === 0) repouso++;
  }
  return { uteis: total - repouso, repouso };
}

interface Resultado {
  valorHoraNormal: number;
  valorHoraExtra: number;
  valorTotalExtras: number;
  dsr: number;
  valor: number;
  memoriaCalculo: { label: string; formula?: string; valor: number }[];
}

interface LinhaLancada {
  chave: string;
  colaboradorId: number;
  nome: string;
  setor: string | null;
  salarioBase: number;
  horas: number;
  adicional: number;
  extras: number;
  dsr: number;
  total: number;
}

/**
 * Cálculo de hora extra por colaborador: adicional de 50% ou 100% (Art. 7º,
 * XVI CF) e reflexo no DSR. O salário vem do cadastro — nada é digitado à mão
 * aqui além das horas e da jornada, para o valor não descolar da folha.
 */
export function HoraExtraTab() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [ano, setAno] = useState(HOJE.getFullYear());
  const [mes, setMes] = useState(HOJE.getMonth() + 1);
  const [colaboradorId, setColaboradorId] = useState("");
  const [horasMensais, setHorasMensais] = useState(220);
  const [horas, setHoras] = useState(0);
  const [adicional, setAdicional] = useState(0.5);
  const [incluirDSR, setIncluirDSR] = useState(true);

  const padraoDias = diasDoMes(ano, mes);
  const [diasUteis, setDiasUteis] = useState(padraoDias.uteis);
  const [diasRepouso, setDiasRepouso] = useState(padraoDias.repouso);

  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [linhas, setLinhas] = useState<LinhaLancada[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/colaboradores");
        const data = await res.json();
        setColaboradores(data.colaboradores ?? []);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const ativos = useMemo(
    () =>
      colaboradores
        .filter((c) => c.status !== "desligado")
        .slice()
        .sort((a, z) => a.nome.localeCompare(z.nome, "pt-BR")),
    [colaboradores],
  );

  const colaborador = ativos.find((c) => String(c.id) === colaboradorId) ?? null;

  /** Recalcula os dias do mês ao trocar a competência, sem apagar um ajuste manual anterior de propósito: a troca de mês é uma nova base. */
  function trocarCompetencia(novoAno: number, novoMes: number) {
    setAno(novoAno);
    setMes(novoMes);
    const dias = diasDoMes(novoAno, novoMes);
    setDiasUteis(dias.uteis);
    setDiasRepouso(dias.repouso);
    setResultado(null);
  }

  async function calcular() {
    if (!colaborador) {
      setErro("Selecione o colaborador.");
      return;
    }
    if (!colaborador.salarioBase || colaborador.salarioBase <= 0) {
      setErro("Este colaborador está sem salário no cadastro — o valor da hora não pode ser apurado.");
      return;
    }
    if (horas <= 0) {
      setErro("Informe a quantidade de horas extras.");
      return;
    }
    setErro(null);
    setCalculando(true);
    try {
      const res = await fetch("/api/calc/horas-extras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salarioBase: colaborador.salarioBase,
          horasMensais,
          horasExtras: horas,
          percentualAdicional: adicional,
          incluirDSR,
          diasUteisMes: diasUteis,
          diasRepousoMes: diasRepouso,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao calcular.");
        return;
      }
      setResultado({ ...data.resultado.detalhe, valor: data.resultado.valor, memoriaCalculo: data.resultado.memoriaCalculo });
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setCalculando(false);
    }
  }

  function lancarNaLista() {
    if (!colaborador || !resultado) return;
    setLinhas((atual) => [
      ...atual,
      {
        chave: `${colaborador.id}-${adicional}-${atual.length}`,
        colaboradorId: colaborador.id,
        nome: colaborador.nome,
        setor: colaborador.departamento,
        salarioBase: colaborador.salarioBase,
        horas,
        adicional,
        extras: resultado.valorTotalExtras,
        dsr: resultado.dsr,
        total: resultado.valor,
      },
    ]);
    setResultado(null);
    setHoras(0);
  }

  const totalLista = linhas.reduce((s, l) => s + l.total, 0);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
              Competência
            </span>
            <div className="flex gap-1.5">
              <select value={mes} onChange={(e) => trocarCompetencia(ano, Number(e.target.value))} className={INPUT}>
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <select value={ano} onChange={(e) => trocarCompetencia(Number(e.target.value), mes)} className={INPUT}>
                {ANOS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label className="block lg:col-span-2">
            <span className="mb-1 block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
              Colaborador
            </span>
            <select
              value={colaboradorId}
              onChange={(e) => {
                setColaboradorId(e.target.value);
                setResultado(null);
              }}
              className={INPUT}
              disabled={carregando}
            >
              <option value="">{carregando ? "Carregando…" : "Selecione…"}</option>
              {ativos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1 block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
              Salário base (cadastro)
            </span>
            <p className="rounded-md border border-hairline bg-surface-page px-2.5 py-1.5 text-[12.5px] font-semibold text-foreground">
              {colaborador ? formatarMoeda(colaborador.salarioBase) : "—"}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
              Jornada mensal (horas)
            </span>
            <input
              type="number"
              min={1}
              value={horasMensais}
              onChange={(e) => {
                setHorasMensais(Number(e.target.value));
                setResultado(null);
              }}
              className={INPUT}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
              Horas extras
            </span>
            <input
              type="number"
              min={0}
              step="0.5"
              value={horas}
              onChange={(e) => {
                setHoras(Number(e.target.value));
                setResultado(null);
              }}
              className={INPUT}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
              Adicional
            </span>
            <select
              value={adicional}
              onChange={(e) => {
                setAdicional(Number(e.target.value));
                setResultado(null);
              }}
              className={INPUT}
            >
              <option value={0.5}>50% — hora extra comum</option>
              <option value={1}>100% — domingo, feriado ou banco</option>
            </select>
          </label>

          <label className="flex items-end gap-2 pb-1.5">
            <input
              type="checkbox"
              checked={incluirDSR}
              onChange={(e) => {
                setIncluirDSR(e.target.checked);
                setResultado(null);
              }}
              className="h-3.5 w-3.5"
            />
            <span className="text-[12px] text-foreground">Refletir no DSR</span>
          </label>
        </div>

        {incluirDSR && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
                Dias úteis do mês
              </span>
              <input
                type="number"
                min={1}
                value={diasUteis}
                onChange={(e) => {
                  setDiasUteis(Number(e.target.value));
                  setResultado(null);
                }}
                className={INPUT}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
                Dias de repouso
              </span>
              <input
                type="number"
                min={1}
                value={diasRepouso}
                onChange={(e) => {
                  setDiasRepouso(Number(e.target.value));
                  setResultado(null);
                }}
                className={INPUT}
              />
            </label>
            <p className="self-end pb-1.5 text-[11px] text-foreground-muted sm:col-span-2">
              Sugerido pelo calendário de {MESES[mes - 1]}/{ano} contando só os domingos. Ajuste para incluir os feriados
              da empresa — o portal não tem calendário de feriados e não chuta um.
            </p>
          </div>
        )}

        {erro && (
          <p className="mt-3 rounded border border-status-danger-border bg-status-danger-bg px-2.5 py-1.5 text-[11.5px] text-status-danger">
            {erro}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void calcular()}
            disabled={calculando}
            className="rounded bg-brand-primary px-3 py-1.5 text-[12.5px] font-medium text-brand-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {calculando ? "Calculando…" : "Calcular"}
          </button>
          {resultado && (
            <button
              type="button"
              onClick={lancarNaLista}
              className="rounded border border-hairline px-3 py-1.5 text-[12.5px] font-medium text-foreground-muted transition-colors hover:bg-surface-page"
            >
              + Somar ao mês
            </button>
          )}
        </div>
      </Card>

      {resultado && (
        <Card className="p-4">
          <p className="text-[10px] font-semibold tracking-wide text-brand-primary-800 uppercase">Memória de cálculo</p>
          <table className="mt-2 w-full text-[12px]">
            <tbody>
              {resultado.memoriaCalculo.map((passo, i) => (
                <tr key={i} className="border-b border-hairline/60 last:border-0">
                  <td className="py-1.5 text-foreground">
                    {passo.label}
                    {passo.formula && (
                      <span className="block text-[10px] text-foreground-muted">{passo.formula}</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right font-medium text-foreground">{formatarMoeda(passo.valor)}</td>
                </tr>
              ))}
              <tr>
                <td className="pt-2 text-[12.5px] font-semibold text-foreground">Total a pagar</td>
                <td className="pt-2 text-right text-[12.5px] font-bold text-foreground">
                  {formatarMoeda(resultado.valor)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[10.5px] text-foreground-muted">
            Cálculo determinístico (lib/calc) — nunca aproximado ou digitado manualmente.
          </p>
        </Card>
      )}

      {linhas.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
            <p className="text-[12.5px] font-semibold text-foreground">
              Hora extra de {MESES[mes - 1]}/{ano}
            </p>
            <button
              type="button"
              onClick={() => setLinhas([])}
              className="text-[11.5px] text-foreground-muted hover:text-foreground"
            >
              Limpar
            </button>
          </div>
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-hairline bg-surface-page text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
                <th className="px-3 py-2">Colaborador</th>
                <th className="px-3 py-2">Setor</th>
                <th className="px-3 py-2 text-right">Horas</th>
                <th className="px-3 py-2 text-right">Adicional</th>
                <th className="px-3 py-2 text-right">Extras</th>
                <th className="px-3 py-2 text-right">DSR</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.chave} className="border-b border-hairline/60 last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground uppercase">{l.nome}</td>
                  <td className="px-3 py-2 text-foreground-muted">{l.setor ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-foreground">{l.horas}</td>
                  <td className="px-3 py-2 text-right text-foreground-muted">{l.adicional * 100}%</td>
                  <td className="px-3 py-2 text-right text-foreground">{formatarMoeda(l.extras)}</td>
                  <td className="px-3 py-2 text-right text-foreground-muted">{formatarMoeda(l.dsr)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">{formatarMoeda(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={cn("border-t border-hairline bg-surface-page px-4 py-2.5 text-right text-[12.5px]")}>
            <span className="text-foreground-muted">Total do mês: </span>
            <strong className="text-foreground">{formatarMoeda(totalLista)}</strong>
          </div>
        </Card>
      )}
    </div>
  );
}
