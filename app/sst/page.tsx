import { redirect } from "next/navigation";
import Link from "next/link";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { obterDashboardSst, type RankedRow } from "@/lib/sst/dashboard";
import type { BadgeTone } from "@/lib/sst/domain";
import { formatarMoeda } from "@/lib/format";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/shared/Card";
import { Badge, type CorBadge } from "@/components/shared/Badge";

export const metadata = { title: "Dashboard SST — Portal Recursos Humanos" };

/**
 * O Badge deste portal só tem 5 tons (N/B/G/A/R — ver components/shared/Badge.tsx),
 * sem um tom "roxo" equivalente ao `purple` do StatusBadge original do SST (usado só
 * para "Necessita revisão", um status à parte de "Vencido"). Mapeado para "azul"
 * (o mesmo tom usado para "em curso/informativo" no resto do Portal DP) — é a
 * aproximação mais próxima sem inventar um token de cor novo no design system.
 */
const TOM_BADGE: Record<BadgeTone, CorBadge> = {
  success: "verde",
  warning: "amarelo",
  danger: "vermelho",
  purple: "azul",
  info: "azul",
  neutral: "neutro",
};

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-[10px] font-bold tracking-[0.16em] text-foreground-muted uppercase">{children}</h2>
      <div className="h-px flex-1 bg-hairline" />
      {aside}
    </div>
  );
}

function KpiTile({
  titulo,
  valor,
  tone,
  destaque,
}: {
  titulo: string;
  valor: number | string;
  tone?: "success" | "warning" | "danger";
  destaque?: boolean;
}) {
  const corValor =
    tone === "success" ? "text-status-success" : tone === "warning" ? "text-status-warning" : tone === "danger" ? "text-status-danger" : "text-brand-primary-800";
  return (
    <Card className={destaque ? "border-status-danger-border bg-status-danger-bg p-4" : "p-4"}>
      <p className="text-[10px] font-bold tracking-wide text-foreground-muted uppercase">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${corValor}`}>{valor}</p>
    </Card>
  );
}

function DonutStatus({
  segmentos,
  pctEmDia,
}: {
  segmentos: { label: string; count: number; color: string }[];
  /** Já vem calculado de lib/sst/dashboard.ts — o denominador ali é o TOTAL de exames
   * (inclui "Pendente", que não aparece como fatia do donut), então não dá pra
   * recalcular esse percentual só a partir da soma das fatias visíveis aqui. */
  pctEmDia: number;
}) {
  const total = segmentos.reduce((acc, s) => acc + s.count, 0);
  const raio = 38;
  const circunferencia = 2 * Math.PI * raio;
  let acumulado = 0;

  return (
    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
      <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
        <circle cx="50" cy="50" r={raio} fill="none" stroke="var(--hairline)" strokeWidth="14" />
        {total > 0 &&
          segmentos.map((s, i) => {
            const fracao = s.count / total;
            if (fracao <= 0) return null;
            const tracoVisivel = fracao * circunferencia;
            const tracoRestante = circunferencia - tracoVisivel;
            const offset = -acumulado * circunferencia;
            acumulado += fracao;
            return (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={raio}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeDasharray={`${tracoVisivel} ${tracoRestante}`}
                strokeDashoffset={offset}
              />
            );
          })}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg font-bold text-foreground">{pctEmDia}%</span>
        <span className="text-[9px] text-foreground-muted">em dia</span>
      </div>
    </div>
  );
}

function BarrasOrcadoRealizado({ dados }: { dados: { mesLabel: string; orcado: number; realizado: number }[] }) {
  const max = Math.max(1, ...dados.flatMap((d) => [d.orcado, d.realizado]));
  if (dados.length === 0) {
    return <p className="py-6 text-center text-[12px] text-foreground-muted">Nenhum orçamento mensal cadastrado ainda.</p>;
  }
  return (
    <div className="flex items-end gap-3 overflow-x-auto pb-1">
      {dados.map((d) => (
        <div key={d.mesLabel} className="flex min-w-[44px] flex-1 flex-col items-center gap-1">
          <div className="flex h-28 w-full items-end justify-center gap-1">
            <div
              className="w-3 rounded-t bg-brand-surface"
              style={{ height: `${Math.max(2, Math.round((d.orcado / max) * 100))}%` }}
              title={`Orçado: ${formatarMoeda(d.orcado)}`}
            />
            <div
              className="w-3 rounded-t bg-brand-primary"
              style={{ height: `${Math.max(2, Math.round((d.realizado / max) * 100))}%` }}
              title={`Realizado: ${formatarMoeda(d.realizado)}`}
            />
          </div>
          <span className="text-[9.5px] text-foreground-muted">{d.mesLabel}</span>
        </div>
      ))}
    </div>
  );
}

function TabelaRanking({ linhas, mostrarMedia }: { linhas: RankedRow[]; mostrarMedia?: boolean }) {
  if (linhas.length === 0) {
    return <p className="px-1 py-3 text-[12px] text-foreground-muted">Sem lançamentos registrados ainda.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10.5px]">
        <thead>
          <tr className="border-b border-hairline bg-background text-left font-bold tracking-wide text-foreground-muted uppercase">
            <th className="px-3 py-1.5">Nome</th>
            <th className="px-3 py-1.5 text-right">Quantidade</th>
            <th className="px-3 py-1.5 text-right">Custo total</th>
            {mostrarMedia && <th className="px-3 py-1.5 text-right">Custo médio</th>}
            <th className="px-3 py-1.5">Participação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((r) => (
            <tr key={r.nome} className="border-t border-hairline/60">
              <td className="px-3 py-1.5 font-semibold text-foreground">{r.nome}</td>
              <td className="px-3 py-1.5 text-right text-foreground">{r.qtd}</td>
              <td className="px-3 py-1.5 text-right font-semibold text-brand-primary-800">{formatarMoeda(r.valor)}</td>
              {mostrarMedia && <td className="px-3 py-1.5 text-right text-foreground-muted">{formatarMoeda(r.media ?? 0)}</td>}
              <td className="px-3 py-1.5">
                <div className="h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-hairline">
                  <div className="h-full rounded-full bg-brand-primary" style={{ width: `${Math.min(100, r.pct)}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function SstDashboardPage() {
  // Defesa extra além do bloqueio já feito em proxy.ts (que redireciona todo
  // gestor não-administrador para /sem-acesso antes mesmo de renderizar
  // qualquer coisa em /sst/*) — ver relatório final sobre essa checagem.
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") {
    redirect("/sem-acesso");
  }

  const data = await obterDashboardSst();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="SST"
        titulo="Dashboard"
        subtitulo="Segurança e Saúde no Trabalho — Portal Recursos Humanos"
      />

      {data.desligamentosPendentes.length > 0 && (
        <Card className="border-status-warning-border bg-status-warning-bg p-4">
          <p className="text-[13px] font-semibold text-foreground">Desligamento pendente</p>
          <p className="mb-3 text-[11.5px] text-foreground-muted">
            Aprovado no Portal PeopleFlow — falta efetivar aqui (anexar o ASO demissional, se aplicável, e confirmar).
          </p>
          <div className="overflow-x-auto rounded-md border border-hairline bg-background">
            <table className="w-full text-[10.5px]">
              <thead>
                <tr className="border-b border-hairline text-left font-bold tracking-wide text-foreground-muted uppercase">
                  <th className="px-3 py-1.5">Colaborador</th>
                  <th className="px-3 py-1.5">Cargo</th>
                  <th className="px-3 py-1.5">Departamento</th>
                  <th className="px-3 py-1.5">Data prevista</th>
                  <th className="px-3 py-1.5">Motivo</th>
                  <th className="px-3 py-1.5">Solicitado por</th>
                </tr>
              </thead>
              <tbody>
                {data.desligamentosPendentes.map((row) => (
                  <tr key={row.colabId} className="border-t border-hairline/60">
                    <td className="px-3 py-1.5 font-semibold text-foreground">{row.nome}</td>
                    <td className="px-3 py-1.5 text-foreground-muted">{row.cargo}</td>
                    <td className="px-3 py-1.5 text-foreground-muted">{row.departamento}</td>
                    <td className="px-3 py-1.5 text-foreground-muted">{row.dataDesligamento}</td>
                    <td className="px-3 py-1.5 text-foreground-muted">{row.motivo}</td>
                    <td className="px-3 py-1.5 text-foreground-muted">{row.solicitadoPor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data.asoDemissionalPendentes.length > 0 && (
        <Card className="border-status-warning-border bg-status-warning-bg p-4">
          <p className="text-[13px] font-semibold text-foreground">ASO demissional pendente</p>
          <p className="mb-3 text-[11.5px] text-foreground-muted">
            Desligamento confirmado com mais de 90 dias — falta anexar o exame demissional na ficha do colaborador.
          </p>
          <div className="overflow-x-auto rounded-md border border-hairline bg-background">
            <table className="w-full text-[10.5px]">
              <thead>
                <tr className="border-b border-hairline text-left font-bold tracking-wide text-foreground-muted uppercase">
                  <th className="px-3 py-1.5">Colaborador</th>
                  <th className="px-3 py-1.5">Cargo</th>
                  <th className="px-3 py-1.5">Departamento</th>
                  <th className="px-3 py-1.5">Desligado em</th>
                  <th className="px-3 py-1.5">Motivo</th>
                  <th className="px-3 py-1.5">Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {data.asoDemissionalPendentes.map((row) => (
                  <tr key={row.colabId} className="border-t border-hairline/60">
                    <td className="px-3 py-1.5 font-semibold text-foreground">{row.nome}</td>
                    <td className="px-3 py-1.5 text-foreground-muted">{row.cargo}</td>
                    <td className="px-3 py-1.5 text-foreground-muted">{row.departamento}</td>
                    <td className="px-3 py-1.5 text-foreground-muted">{row.desligadoEm}</td>
                    <td className="px-3 py-1.5 text-foreground-muted">{row.motivo}</td>
                    <td className="px-3 py-1.5 text-foreground-muted">{row.solicitadoPor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data.programasAtencao.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-status-warning-border bg-status-warning-bg p-4">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Programas de Saúde Ocupacional — atenção necessária</p>
            <p className="text-[11.5px] text-foreground-muted">
              {data.programasAtencao.map((p) => `${p.programa}: ${p.status}`).join(" · ")}
            </p>
          </div>
          <Link href="/sst/programas" className="text-[12px] font-medium text-brand-primary hover:text-brand-primary-hover">
            Ver Programas de SST →
          </Link>
        </Card>
      )}

      <section className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiTile titulo="Colaboradores na base" valor={data.kpi.colaboradores} />
          <KpiTile titulo="Com matriz de EPI" valor={data.kpi.classificados} />
          <KpiTile titulo="Exames em dia" valor={data.kpi.asoEmDia} tone="success" />
          <KpiTile titulo="A vencer (60 dias)" valor={data.kpi.aVencer} tone="warning" />
          <KpiTile titulo="Vencidos + revisão" valor={data.kpi.pendencias} tone="danger" destaque />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Conformidade de ASO</SectionTitle>
        <Card className="flex flex-wrap items-center gap-6 p-4">
          <DonutStatus segmentos={data.donutLegend} pctEmDia={data.pctEmDia} />
          <div className="flex flex-col gap-1.5">
            {data.donutLegend.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-[12px] text-foreground">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                {item.label} · <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle>Fichas de EPI pendentes de assinatura</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile titulo="Fichas geradas" valor={data.fichasEpi.total} />
          <KpiTile titulo="Fichas assinadas" valor={data.fichasEpi.assinadas} tone="success" />
          <KpiTile titulo="Aguardando assinatura" valor={data.fichasEpi.aguardando} tone="warning" />
          <KpiTile titulo="Entregas sem ficha ainda" valor={data.fichasEpi.semFicha} tone="danger" />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle
          aside={
            <Link href="/sst/exames" className="text-[11px] font-medium text-brand-primary hover:text-brand-primary-hover">
              Ver exames →
            </Link>
          }
        >
          Pendências que exigem ação
        </SectionTitle>
        <Card className="overflow-hidden">
          {data.pendenciaRows.length === 0 ? (
            <p className="p-4 text-[12px] text-foreground-muted">Nenhuma pendência no momento — base em conformidade.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[10.5px]">
                <thead>
                  <tr className="border-b border-hairline bg-background text-left font-bold tracking-wide text-foreground-muted uppercase">
                    <th className="px-3 py-1.5">Colaborador</th>
                    <th className="px-3 py-1.5">Departamento</th>
                    <th className="px-3 py-1.5">Exame</th>
                    <th className="px-3 py-1.5">Próxima data</th>
                    <th className="px-3 py-1.5 text-right">Dias em atraso</th>
                    <th className="px-3 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendenciaRows.map((row, i) => (
                    <tr key={i} className="border-t border-hairline/60">
                      <td className="px-3 py-1.5 font-semibold text-foreground">{row.nome}</td>
                      <td className="px-3 py-1.5 text-foreground-muted">{row.departamento}</td>
                      <td className="px-3 py-1.5 text-foreground-muted">{row.item}</td>
                      <td className="px-3 py-1.5 text-foreground-muted">{row.vencimento}</td>
                      <td className="px-3 py-1.5 text-right text-foreground-muted">{row.diasAtraso ?? "—"}</td>
                      <td className="px-3 py-1.5">
                        <Badge cor={TOM_BADGE[row.tone]}>{row.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle
          aside={
            <span className="text-[11px] text-foreground-muted/70">
              orçado {formatarMoeda(data.custoEpi.orcadoAno)} · realizado {formatarMoeda(data.custoEpi.realizadoAno)} ·{" "}
              {data.custoEpi.pctAno}% consumido
            </span>
          }
        >
          Custos de EPI · realizado × orçado
        </SectionTitle>
        <Card className="p-4">
          <BarrasOrcadoRealizado dados={data.custoEpi.meses} />
          <div className="mt-3 flex items-center gap-4 text-[10.5px] text-foreground-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand-surface" /> Orçado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand-primary" /> Realizado
            </span>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[10.5px]">
              <thead>
                <tr className="border-b border-hairline bg-background text-left font-bold tracking-wide text-foreground-muted uppercase">
                  <th className="px-3 py-1.5">Mês</th>
                  <th className="px-3 py-1.5 text-right">Orçado</th>
                  <th className="px-3 py-1.5 text-right">Realizado</th>
                  <th className="px-3 py-1.5 text-right">Diferença</th>
                  <th className="px-3 py-1.5">% consumo</th>
                </tr>
              </thead>
              <tbody>
                {data.custoEpi.meses.map((m) => (
                  <tr key={m.mes} className="border-t border-hairline/60">
                    <td className="px-3 py-1.5 font-semibold text-foreground">{m.mesLabel}</td>
                    <td className="px-3 py-1.5 text-right text-foreground-muted">{formatarMoeda(m.orcado)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-foreground">{formatarMoeda(m.realizado)}</td>
                    <td className={`px-3 py-1.5 text-right font-semibold ${m.dif > 0 ? "text-status-danger" : "text-status-success"}`}>
                      {m.dif >= 0 ? "+" : "−"} {formatarMoeda(Math.abs(m.dif))}
                    </td>
                    <td className="px-3 py-1.5">
                      <Badge cor={TOM_BADGE[m.pctTone]}>{m.pctConsumo}%</Badge>
                    </td>
                  </tr>
                ))}
                {data.custoEpi.meses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-foreground-muted">
                      Nenhum orçamento mensal cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <p className="border-b border-hairline px-3 py-2 text-[11px] font-semibold text-foreground">Por departamento</p>
            <TabelaRanking linhas={data.custoEpi.porDepartamento} mostrarMedia />
          </Card>
          <Card className="overflow-hidden">
            <p className="border-b border-hairline px-3 py-2 text-[11px] font-semibold text-foreground">Por colaborador</p>
            <TabelaRanking linhas={data.custoEpi.porColaborador} />
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle
          aside={
            <span className="text-[11px] text-foreground-muted/70">
              entregas {formatarMoeda(data.custoFardamento.entregasAno)} · reparos {formatarMoeda(data.custoFardamento.reparosAno)} ·
              orçado {formatarMoeda(data.custoFardamento.orcadoAno)}
            </span>
          }
        >
          Custos de Fardamento · entregas + reparos × orçado
        </SectionTitle>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[10.5px]">
              <thead>
                <tr className="border-b border-hairline bg-background text-left font-bold tracking-wide text-foreground-muted uppercase">
                  <th className="px-3 py-1.5">Mês</th>
                  <th className="px-3 py-1.5 text-right">Entregas</th>
                  <th className="px-3 py-1.5 text-right">Reparos</th>
                  <th className="px-3 py-1.5 text-right">Realizado</th>
                  <th className="px-3 py-1.5 text-right">Orçado</th>
                  <th className="px-3 py-1.5 text-right">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {data.custoFardamento.meses.map((m) => (
                  <tr key={m.mes} className="border-t border-hairline/60">
                    <td className="px-3 py-1.5 font-semibold text-foreground">{m.mesLabel}</td>
                    <td className="px-3 py-1.5 text-right text-foreground-muted">{formatarMoeda(m.entrega)}</td>
                    <td className="px-3 py-1.5 text-right text-foreground-muted">{formatarMoeda(m.reparo)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-foreground">{formatarMoeda(m.realizado)}</td>
                    <td className="px-3 py-1.5 text-right text-foreground-muted">{formatarMoeda(m.orcado)}</td>
                    <td className={`px-3 py-1.5 text-right font-semibold ${m.dif > 0 ? "text-status-danger" : "text-status-success"}`}>
                      {m.dif >= 0 ? "+" : "−"} {formatarMoeda(Math.abs(m.dif))}
                    </td>
                  </tr>
                ))}
                {data.custoFardamento.meses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-foreground-muted">
                      Nenhum orçamento mensal cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <p className="border-b border-hairline px-3 py-2 text-[11px] font-semibold text-foreground">Por departamento</p>
            <TabelaRanking linhas={data.custoFardamento.porDepartamento} />
          </Card>
          <Card className="overflow-hidden">
            <p className="border-b border-hairline px-3 py-2 text-[11px] font-semibold text-foreground">Por colaborador</p>
            <TabelaRanking linhas={data.custoFardamento.porColaborador} />
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Exames ocupacionais · previsto × realizado</SectionTitle>
        <Card className="p-4">
          <p className="mb-3 text-[11.5px] text-foreground-muted">
            Previsto a partir do valor do exame na matriz ocupacional (× cargos); realizado a partir dos exames lançados nas fichas.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-hairline bg-surface-page p-3">
              <p className="text-[10px] font-bold tracking-wide text-foreground-muted uppercase">Previsto estimado (matriz)</p>
              <p className="mt-1 text-lg font-bold text-brand-primary-800">{formatarMoeda(data.exames.previsto)}</p>
              <p className="mt-1 text-[10.5px] text-foreground-muted">
                {data.exames.examesComValor} de {data.exames.catExamesCount} exames com valor cadastrado
              </p>
            </div>
            <div className="rounded-md border border-hairline bg-surface-page p-3">
              <p className="text-[10px] font-bold tracking-wide text-foreground-muted uppercase">Realizado (exames lançados)</p>
              <p className="mt-1 text-lg font-bold text-foreground">{formatarMoeda(data.exames.realizado)}</p>
              <p className="mt-1 text-[10.5px] text-foreground-muted">{data.exames.examesRealizadosCount} exame(s) com valor realizado</p>
            </div>
            <div className="rounded-md border border-hairline bg-surface-page p-3">
              <p className="text-[10px] font-bold tracking-wide text-foreground-muted uppercase">Diferença</p>
              <p className={`mt-1 text-lg font-bold ${data.exames.dif > 0 ? "text-status-danger" : "text-status-success"}`}>
                {data.exames.dif >= 0 ? "+" : "−"} {formatarMoeda(Math.abs(data.exames.dif))}
              </p>
              <p className="mt-1 text-[10.5px] text-foreground-muted">realizado − previsto</p>
            </div>
          </div>
          {!data.exames.hasPrevisto && (
            <p className="mt-3 text-[11.5px] text-status-warning">
              Cadastre o valor do exame na aba Exames → Matriz ocupacional para alimentar o valor previsto deste comparativo.
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}
