"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardFerias } from "@/lib/db/dashboardFerias";
import { formatarMoeda, formatarDataBr } from "@/lib/format";
import { Card } from "@/components/shared/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/lib/cn";

const ANO_ATUAL = new Date().getFullYear();
const ANOS_DISPONIVEIS = [ANO_ATUAL, ANO_ATUAL + 1, ANO_ATUAL + 2];

const MESES_COMPLETOS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const FAIXA_TRIMESTRE: Record<1 | 2 | 3 | 4, string> = {
  1: "jan-fev-mar",
  2: "abr-mai-jun",
  3: "jul-ago-set",
  4: "out-nov-dez",
};

function mesAnoPorExtenso(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  return `${MESES_COMPLETOS[Number(mes) - 1] ?? mes}/${ano}`;
}

function mesAbrevAno(competencia: string | null): string {
  if (!competencia) return "—";
  const [ano, mes] = competencia.split("-");
  return `${(MESES_COMPLETOS[Number(mes) - 1] ?? mes).slice(0, 3)}/${ano}`;
}

function IconeCalendario() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M6 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm10 6H4v8h12V8Z" />
    </svg>
  );
}

function IconeSetor() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M2 5a1 1 0 0 1 1-1h4l1.5 2H17a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5Z" />
    </svg>
  );
}

function IconeLapis() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M14.85 2.15a1.5 1.5 0 0 1 2.12 0l.88.88a1.5 1.5 0 0 1 0 2.12l-1.1 1.1-3-3 1.1-1.1Zm-2.16 2.16 3 3L6.94 16.06a1 1 0 0 1-.46.26l-3.1.83.83-3.1a1 1 0 0 1 .26-.46L12.7 4.3Z" />
    </svg>
  );
}

function IconeArquivo() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M5 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-6-6H5Zm6 1.5L15.5 8H12a1 1 0 0 1-1-1V3.5Z" />
    </svg>
  );
}

function IconeTrimestre() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M6 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm-2 8h4v4H4v-4Z" />
    </svg>
  );
}

export function DashboardFeriasClient() {
  const [ano, setAno] = useState(ANO_ATUAL);
  const [setor, setSetor] = useState("");
  const [dados, setDados] = useState<DashboardFerias | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [trimestreAberto, setTrimestreAberto] = useState<number | null>(null);
  const [menuProgramarAberto, setMenuProgramarAberto] = useState(false);

  async function recarregar() {
    try {
      const params = new URLSearchParams({ ano: String(ano) });
      if (setor) params.set("setor", setor);
      const res = await fetch(`/api/dashboard/ferias?${params.toString()}`);
      setDados(await res.json());
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, setor]);

  if (carregando && !dados) return <p className="text-sm text-foreground-muted">Carregando...</p>;
  if (!dados) return <p className="text-sm text-foreground-muted">Não foi possível carregar o dashboard.</p>;

  const maxColaboradoresTrimestre = Math.max(1, ...dados.porTrimestre.map((t) => t.colaboradores));
  const subtitulo = `${dados.empregadosAtivos} empregados ativos · competência ${mesAnoPorExtenso(dados.competencia)}${
    dados.dataBaseRelatorio ? ` · base: relatório do DP de ${formatarDataBr(dados.dataBaseRelatorio)}` : ""
  }`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Férias · Painel"
        titulo="Dashboard de Férias"
        subtitulo={subtitulo}
        acao={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 rounded border border-hairline bg-background px-2.5 py-1.5 text-[12px] text-foreground dark:border-brand-neutral/30">
              <IconeCalendario />
              <select
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
                className="bg-transparent outline-none"
              >
                {ANOS_DISPONIVEIS.map((a) => (
                  <option key={a} value={a}>
                    Ano {a}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-1.5 rounded border border-hairline bg-background px-2.5 py-1.5 text-[12px] text-foreground dark:border-brand-neutral/30">
              <IconeSetor />
              <select value={setor} onChange={(e) => setSetor(e.target.value)} className="bg-transparent outline-none">
                <option value="">Todos os setores</option>
                {dados.setoresDisponiveis.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuProgramarAberto((v) => !v)}
                className="flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-[12.5px] font-medium text-brand-white shadow-card transition-colors hover:bg-brand-primary-hover"
              >
                <span aria-hidden>+</span> Programar férias
                <span aria-hidden className="text-[9px]">
                  ▾
                </span>
              </button>
              {menuProgramarAberto && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setMenuProgramarAberto(false)} />
                  <div className="absolute top-full right-0 z-30 mt-1.5 w-[300px] rounded-md border border-hairline bg-background p-3 shadow-drawer">
                    <p className="mb-2 text-[10px] font-semibold tracking-wide text-brand-primary-800 uppercase">
                      Como deseja programar
                    </p>
                    <div className="flex flex-col gap-1">
                      <Link
                        href="/ferias?aba=controle"
                        onClick={() => setMenuProgramarAberto(false)}
                        className="flex items-start gap-2.5 rounded px-2 py-2 text-left transition-colors hover:bg-surface-page"
                      >
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-primary-100 text-brand-primary-800">
                          <IconeLapis />
                        </span>
                        <span>
                          <span className="block text-[12px] font-medium text-foreground">Lançar manualmente</span>
                          <span className="block text-[10.5px] text-foreground-muted">
                            um colaborador · período, dias e abono
                          </span>
                        </span>
                      </Link>

                      <Link
                        href="/ferias?aba=controle"
                        onClick={() => setMenuProgramarAberto(false)}
                        className="flex items-start gap-2.5 rounded px-2 py-2 text-left transition-colors hover:bg-surface-page"
                      >
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-primary-100 text-brand-primary-800">
                          <IconeArquivo />
                        </span>
                        <span>
                          <span className="block text-[12px] font-medium text-foreground">Importar planilha</span>
                          <span className="block text-[10.5px] text-foreground-muted">
                            PDF, XLS ou XLSX · em Controle de Férias → Importar arquivo
                          </span>
                        </span>
                      </Link>

                      <Link
                        href="/ferias?aba=planejamento"
                        onClick={() => setMenuProgramarAberto(false)}
                        className="flex items-start gap-2.5 rounded px-2 py-2 text-left transition-colors hover:bg-surface-page"
                      >
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-primary-100 text-brand-primary-800">
                          <IconeTrimestre />
                        </span>
                        <span>
                          <span className="block text-[12px] font-medium text-foreground">
                            Planejamento por trimestre
                          </span>
                          <span className="block text-[10.5px] text-foreground-muted">montar o ano inteiro por setor</span>
                        </span>
                      </Link>
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2 text-[11px]">
                      <span className="text-foreground-muted">
                        {dados.colaboradoresSemProgramacao} colaborador(es) sem programação
                      </span>
                      <Link
                        href="/ferias?aba=controle"
                        onClick={() => setMenuProgramarAberto(false)}
                        className="font-medium text-brand-primary hover:text-brand-primary-hover"
                      >
                        Ver lista
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        }
      />

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-[10px] font-bold tracking-[0.16em] text-foreground-muted uppercase">Por trimestre · {ano}</h2>
          <div className="h-px flex-1 bg-hairline" />
          <span className="text-[11px] text-brand-primary-800">
            {dados.totalAno.colaboradores} colaboradores · {formatarMoeda(dados.totalAno.valorPago)} ao colaborador ·{" "}
            {formatarMoeda(dados.totalAno.encargos)} de encargos
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dados.porTrimestre.map((t) => {
            const aberto = trimestreAberto === t.trimestre;
            const vazio = t.colaboradores === 0;
            const larguraBarra = vazio ? 0 : Math.max(6, (t.colaboradores / maxColaboradoresTrimestre) * 100);
            return (
              <Card key={t.trimestre} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTrimestreAberto(aberto ? null : t.trimestre)}
                  className="flex w-full flex-col items-start gap-1.5 p-4 text-left"
                >
                  <span className="text-[13px]">
                    <span className="font-bold text-foreground">Q{t.trimestre}</span>{" "}
                    <span className="text-foreground-muted">{FAIXA_TRIMESTRE[t.trimestre]}</span>
                  </span>
                  <span className={cn("text-2xl font-semibold tracking-tight", vazio ? "text-foreground-muted/50" : "text-brand-primary-800")}>
                    {t.colaboradores}
                  </span>
                  <span className="-mt-1 text-[10.5px] text-foreground-muted">colaboradores</span>

                  <div className="h-1 w-full overflow-hidden rounded-full bg-hairline">
                    <div
                      className="h-full rounded-full bg-brand-primary transition-all"
                      style={{ width: `${larguraBarra}%` }}
                    />
                  </div>

                  <div className="mt-1 flex w-full items-center justify-between text-[11px]">
                    <span className="text-foreground-muted">Pago ao colaborador</span>
                    <span className={cn("font-semibold", vazio ? "text-foreground-muted" : "text-brand-primary-800")}>
                      {formatarMoeda(t.valorPago)}
                    </span>
                  </div>
                  <div className="flex w-full items-center justify-between text-[11px]">
                    <span className="text-foreground-muted">Custo com encargos</span>
                    <span className={cn("font-semibold", vazio ? "text-foreground-muted" : "text-status-warning")}>
                      {formatarMoeda(t.encargos)}
                    </span>
                  </div>
                </button>

                {aberto && (
                  <div className="border-t border-hairline bg-surface-page">
                    <div className="flex items-center justify-between border-b border-hairline bg-brand-primary-050 px-4 py-2">
                      <span className="text-[13px] font-bold text-brand-primary-800">
                        Q{t.trimestre} · {ano}
                      </span>
                      <span className="rounded-full border border-hairline bg-background px-2 py-0.5 text-[9.5px] font-bold text-brand-primary-800">
                        {t.linhas.length} colaborador(es)
                      </span>
                    </div>
                    {t.linhas.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-foreground-muted">Nenhum período com limite neste trimestre.</p>
                    ) : (
                      <div className="max-h-72 overflow-y-auto">
                        <table className="w-full text-[10.5px]">
                          <thead>
                            <tr className="border-b border-hairline bg-background text-left font-bold tracking-wide text-foreground-muted uppercase">
                              <th className="px-3 py-1.5">Colaborador / Setor</th>
                              <th className="px-3 py-1.5 text-right">Dias</th>
                              <th className="px-3 py-1.5 text-right">Valor férias</th>
                              <th className="px-3 py-1.5 text-right">Encargos</th>
                              <th className="px-3 py-1.5 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.linhas.map((l, i) => (
                              <tr key={i} className="border-t border-hairline/60">
                                <td className="px-3 py-1.5">
                                  <div className="font-semibold text-foreground">{l.colaboradorNome}</div>
                                  <div className="text-foreground-muted">{l.colaboradorDepartamento ?? "—"}</div>
                                </td>
                                <td className="px-3 py-1.5 text-right font-semibold text-foreground">{l.dias}</td>
                                <td className="px-3 py-1.5 text-right font-semibold text-brand-primary-800">
                                  {formatarMoeda(l.valorFerias)}
                                </td>
                                <td className="px-3 py-1.5 text-right font-semibold text-status-warning">
                                  {formatarMoeda(l.encargos)}
                                </td>
                                <td className="px-3 py-1.5 text-right font-bold text-foreground">{formatarMoeda(l.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-hairline bg-background font-bold">
                              <td className="px-3 py-1.5 text-foreground">Total do trimestre</td>
                              <td />
                              <td className="px-3 py-1.5 text-right text-brand-primary-800">{formatarMoeda(t.valorPago)}</td>
                              <td className="px-3 py-1.5 text-right text-status-warning">{formatarMoeda(t.encargos)}</td>
                              <td className="px-3 py-1.5 text-right text-foreground">
                                {formatarMoeda(t.valorPago + t.encargos)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-[10px] font-bold tracking-[0.16em] text-foreground-muted uppercase">Financeiro</h2>
          <div className="h-px flex-1 bg-hairline" />
          <span className="text-[11px] text-foreground-muted/70">valores em BRL · inclui 1/3 constitucional</span>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="p-4">
            <p className="text-[10px] font-bold tracking-wide text-foreground-muted uppercase">Já pago — meses anteriores</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-brand-primary-800">{formatarMoeda(dados.jaPago.valor)}</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-status-success-bg">
              <div
                className="h-full rounded-full bg-status-success transition-all"
                style={{ width: `${Math.min(100, dados.jaPago.percentualDoAnual)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-status-success">
              {dados.jaPago.periodosPagos === 0
                ? "Nenhum período pago ainda neste ano"
                : `${mesAbrevAno(dados.jaPago.mesInicio)} a ${mesAbrevAno(dados.jaPago.mesFim)} · ${dados.jaPago.periodosPagos} período(s) pago(s) · ${dados.jaPago.percentualDoAnual}% do custo anual`}
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-[10px] font-bold tracking-wide text-foreground-muted uppercase">
              Previsto para {MESES_COMPLETOS[Number(dados.competencia.slice(5, 7)) - 1]}
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{formatarMoeda(dados.previsto.valor)}</p>
            <div className="mt-2 flex gap-1.5">
              <span className="rounded-full bg-brand-primary-100 px-2 py-0.5 text-[10.5px] font-semibold text-brand-primary-800">
                {dados.previsto.periodos} período(s)
              </span>
              <span className="rounded-full bg-brand-primary-100 px-2 py-0.5 text-[10.5px] font-semibold text-brand-primary-800">
                média {formatarMoeda(dados.previsto.media)}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-foreground-muted">
              mês vigente · {dados.previsto.diasAusencia} dias de ausência · {dados.previsto.pagamentosEmAberto} pagamento(s) em
              aberto
            </p>
          </Card>

          <div className="relative overflow-hidden rounded-md border border-hairline bg-brand-dark-900 p-4 shadow-card">
            <p className="text-[10px] font-bold tracking-wide text-brand-white/70 uppercase">Custo anual estimado</p>
            {/* O valor tem duas origens e o usuário precisa saber qual é qual —
                daí a divisão aparecer ao passar o mouse, sem poluir o card. */}
            <p className="group relative mt-1 inline-block cursor-help text-2xl font-bold tracking-tight text-brand-white underline decoration-brand-white/30 decoration-dotted underline-offset-4">
              {formatarMoeda(dados.custoAnual.valor)}
              <span className="pointer-events-none absolute top-full left-0 z-40 mt-2 hidden w-72 rounded-md border border-hairline bg-background p-3 text-left shadow-drawer group-hover:block">
                <span className="block text-[10px] font-bold tracking-wide text-foreground-muted uppercase">
                  De onde vem o valor
                </span>

                <span className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-[11.5px] font-semibold text-foreground">Planejado</span>
                  <span className="text-[12px] font-bold text-foreground">
                    {formatarMoeda(dados.custoAnual.planejado.total)}
                  </span>
                </span>
                <span className="block text-[10.5px] font-normal text-foreground-muted">
                  {dados.custoAnual.planejado.periodos} programação(ões) já lançada(s) · férias{" "}
                  {formatarMoeda(dados.custoAnual.planejado.valor)} + encargos{" "}
                  {formatarMoeda(dados.custoAnual.planejado.encargos)}
                </span>

                <span className="mt-2.5 flex items-baseline justify-between gap-2">
                  <span className="text-[11.5px] font-semibold text-foreground">De acordo com o vencimento</span>
                  <span className="text-[12px] font-bold text-foreground">
                    {formatarMoeda(dados.custoAnual.porVencimento.total)}
                  </span>
                </span>
                <span className="block text-[10.5px] font-normal text-foreground-muted">
                  {dados.custoAnual.porVencimento.periodos} período(s) com saldo a gozar até dezembro · férias{" "}
                  {formatarMoeda(dados.custoAnual.porVencimento.valor)} + encargos{" "}
                  {formatarMoeda(dados.custoAnual.porVencimento.encargos)}
                </span>

                <span className="mt-2.5 flex items-baseline justify-between gap-2 border-t border-hairline pt-2">
                  <span className="text-[11.5px] font-bold text-foreground">Total</span>
                  <span className="text-[12px] font-bold text-foreground">{formatarMoeda(dados.custoAnual.valor)}</span>
                </span>
              </span>
            </p>

            <svg viewBox="0 0 64 64" className="pointer-events-none absolute top-3 right-3 h-16 w-16 opacity-90">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="var(--brand-accent)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${(Math.min(100, dados.custoAnual.percentualEncargos) / 100) * 2 * Math.PI * 26} ${2 * Math.PI * 26}`}
                transform="rotate(-90 32 32)"
              />
            </svg>

            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-brand-accent transition-all"
                style={{ width: `${Math.min(100, dados.custoAnual.percentualEncargos)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-brand-white/70">
              encargos {formatarMoeda(dados.custoAnual.encargos)} · {dados.custoAnual.percentualEncargos}%
            </p>
            <p className="mt-2 text-[10.5px] text-brand-white/60">
              planejado + o que vence até dezembro · férias + 1/3 + abono + FGTS 8% + INSS patronal 20% ·{" "}
              {dados.custoAnual.programacoesCalculadas}{" "}
              programação(ões) calculada(s)
              {dados.custoAnual.semSalarioCadastrado > 0
                ? ` · ${dados.custoAnual.semSalarioCadastrado} sem salário cadastrado`
                : ""}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-[10px] font-bold tracking-[0.16em] text-foreground-muted uppercase">Controle</h2>
          <div className="h-px flex-1 bg-hairline" />
          <span className="text-[11px] text-foreground-muted/70">situação dos períodos em {ano}</span>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[13.5px] font-bold text-foreground">Férias</h3>
              <button
                type="button"
                title="Em breve"
                disabled
                className="flex cursor-not-allowed items-center gap-1 rounded border border-hairline px-2 py-1 text-[11px] font-medium text-foreground-muted opacity-60 dark:border-brand-neutral/30"
              >
                <span aria-hidden>↑</span> Importar
              </button>
            </div>
            <div className="grid grid-cols-3 divide-x divide-hairline">
              <div className="pr-3">
                <p className="text-[9.5px] font-bold tracking-wide text-foreground-muted uppercase">Programadas</p>
                <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">{dados.controle.programadas}</p>
                <p className="text-[10px] text-foreground-muted">período(s) lançados</p>
              </div>
              <div className="px-3">
                <p className="text-[9.5px] font-bold tracking-wide text-foreground-muted uppercase">Realizadas</p>
                <p className="mt-0.5 text-2xl font-bold tracking-tight text-status-success">{dados.controle.realizadas}</p>
                <p className="text-[10px] text-foreground-muted">com gozo confirmado</p>
              </div>
              <div className="pl-3">
                <p className="text-[9.5px] font-bold tracking-wide text-foreground-muted uppercase">Pendentes</p>
                <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">{dados.controle.pendentes}</p>
                <p className="text-[10px] text-foreground-muted">aguardando gozo</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[13.5px] font-bold text-foreground">Vencimentos</h3>
              <Link
                href="/ferias?aba=controle"
                className="text-[11px] font-medium text-brand-primary hover:text-brand-primary-hover"
              >
                Ver no controle ›
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-2.5">
                <p className="flex items-center gap-1 text-[9px] font-bold tracking-wide text-status-danger uppercase">
                  <span aria-hidden>⚠</span> Vencidas
                </p>
                <p className="mt-0.5 text-xl font-bold tracking-tight text-status-danger">{dados.controle.vencidas}</p>
                <p className="text-[9px] text-status-danger/80">em dobra (Art. 137)</p>
              </div>
              <div className="rounded-lg border border-status-warning-border bg-status-warning-bg p-2.5">
                <p className="text-[9px] font-bold tracking-wide text-status-warning uppercase">A vencer · 30d</p>
                <p className="mt-0.5 text-xl font-bold tracking-tight text-status-warning">{dados.controle.vencendo30}</p>
                <p className="text-[9px] text-status-warning/80">período(s)</p>
              </div>
              <div className="rounded-lg border border-status-warning-border bg-status-warning-bg p-2.5">
                <p className="text-[9px] font-bold tracking-wide text-status-warning uppercase">A vencer · 60d</p>
                <p className="mt-0.5 text-xl font-bold tracking-tight text-status-warning">{dados.controle.vencendo60}</p>
                <p className="text-[9px] text-status-warning/80">período(s)</p>
              </div>
              <div className="rounded-lg border border-status-warning-border bg-status-warning-bg p-2.5">
                <p className="text-[9px] font-bold tracking-wide text-status-warning uppercase">A vencer · 90d</p>
                <p className="mt-0.5 text-xl font-bold tracking-tight text-status-warning">{dados.controle.vencendo90}</p>
                <p className="text-[9px] text-status-warning/80">período(s)</p>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
