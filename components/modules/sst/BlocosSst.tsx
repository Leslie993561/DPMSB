import type { DashboardSst, RankedRow } from "@/lib/sst/dashboard";
import type { BadgeTone } from "@/lib/sst/domain";
import { formatarMoeda } from "@/lib/format";
import { Card } from "@/components/shared/Card";
import { Badge, type CorBadge } from "@/components/shared/Badge";

/**
 * Blocos do Dashboard SST reaproveitados em outras páginas (a Gestão de EPI
 * mostra o mesmo bloco de EPI no topo) — um lugar só para os dois não
 * divergirem.
 */

/**
 * O Badge deste portal só tem 5 tons; o "roxo" do StatusBadge original do SST
 * (usado só em "Necessita revisão") vira azul, o tom informativo do portal.
 */
export const TOM_BADGE: Record<BadgeTone, CorBadge> = {
  success: "verde",
  warning: "amarelo",
  danger: "vermelho",
  purple: "azul",
  info: "azul",
  neutral: "neutro",
};

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-[10px] font-bold tracking-[0.16em] text-foreground-muted uppercase">{children}</h2>
      <div className="h-px flex-1 bg-hairline" />
      {aside}
    </div>
  );
}

export function KpiTile({
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
    tone === "success"
      ? "text-status-success"
      : tone === "warning"
        ? "text-status-warning"
        : tone === "danger"
          ? "text-status-danger"
          : "text-brand-primary-800";
  return (
    <Card className={destaque ? "border-status-danger-border bg-status-danger-bg px-3 py-2.5" : "px-3 py-2.5"}>
      <p className="text-[10px] font-bold tracking-wide text-foreground-muted uppercase">{titulo}</p>
      <p className={`text-xl font-bold tracking-tight ${corValor}`}>{valor}</p>
    </Card>
  );
}

function DonutStatus({
  segmentos,
  pctEmDia,
}: {
  segmentos: { label: string; count: number; color: string }[];
  /** Vem pronto de lib/sst/dashboard.ts: o denominador é o total de exames (inclui "Pendente", que não vira fatia). */
  pctEmDia: number;
}) {
  const total = segmentos.reduce((acc, s) => acc + s.count, 0);
  const raio = 38;
  const circunferencia = 2 * Math.PI * raio;
  let acumulado = 0;

  return (
    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
      <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
        <circle cx="50" cy="50" r={raio} fill="none" stroke="var(--hairline)" strokeWidth="14" />
        {total > 0 &&
          segmentos.map((s, i) => {
            const fracao = s.count / total;
            if (fracao <= 0) return null;
            const tracoVisivel = fracao * circunferencia;
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
                strokeDasharray={`${tracoVisivel} ${circunferencia - tracoVisivel}`}
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
          <div className="flex h-20 w-full items-end justify-center gap-1">
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

export function TabelaRanking({ linhas, mostrarMedia }: { linhas: RankedRow[]; mostrarMedia?: boolean }) {
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

/** Fichas (assinadas / aguardando / sem ficha) e custos de EPI. */
export function BlocoGestaoEpi({
  fichasEpi,
  custoEpi,
  comTitulo = true,
}: {
  fichasEpi: DashboardSst["fichasEpi"];
  custoEpi: DashboardSst["custoEpi"];
  comTitulo?: boolean;
}) {
  return (
    <section className="space-y-2">
      {comTitulo && <SectionTitle>Gestão de EPI</SectionTitle>}
      <div className="grid gap-2 sm:grid-cols-3">
        <KpiTile titulo="Fichas assinadas" valor={fichasEpi.assinadas} tone="success" />
        <KpiTile titulo="Aguardando assinatura" valor={fichasEpi.aguardando} tone="warning" />
        <KpiTile titulo="Entregas sem ficha ainda" valor={fichasEpi.semFicha} tone="danger" />
      </div>

      <p className="pt-1 text-[11px] text-foreground-muted">
        <span className="font-semibold text-foreground">Custos de EPI</span> · orçado {formatarMoeda(custoEpi.orcadoAno)}{" "}
        · realizado {formatarMoeda(custoEpi.realizadoAno)} · {custoEpi.pctAno}% consumido
      </p>
      <div className="grid gap-2 lg:grid-cols-2">
        <Card className="px-3 py-2.5">
          <BarrasOrcadoRealizado dados={custoEpi.meses} />
          <div className="mt-2 flex items-center gap-4 text-[10.5px] text-foreground-muted">
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
                {custoEpi.meses.map((m) => (
                  <tr key={m.mes} className="border-t border-hairline/60">
                    <td className="px-3 py-1.5 font-semibold text-foreground">{m.mesLabel}</td>
                    <td className="px-3 py-1.5 text-right text-foreground-muted">{formatarMoeda(m.orcado)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-foreground">{formatarMoeda(m.realizado)}</td>
                    <td
                      className={`px-3 py-1.5 text-right font-semibold ${m.dif > 0 ? "text-status-danger" : "text-status-success"}`}
                    >
                      {m.dif >= 0 ? "+" : "−"} {formatarMoeda(Math.abs(m.dif))}
                    </td>
                    <td className="px-3 py-1.5">
                      <Badge cor={TOM_BADGE[m.pctTone]}>{m.pctConsumo}%</Badge>
                    </td>
                  </tr>
                ))}
                {custoEpi.meses.length === 0 && (
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
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <p className="border-b border-hairline px-3 py-1.5 text-[11px] font-semibold text-foreground">Por departamento</p>
          <TabelaRanking linhas={custoEpi.porDepartamento} mostrarMedia />
        </Card>
        <Card className="overflow-hidden">
          <p className="border-b border-hairline px-3 py-1.5 text-[11px] font-semibold text-foreground">Por colaborador</p>
          <TabelaRanking linhas={custoEpi.porColaborador} />
        </Card>
      </div>
    </section>
  );
}

/** Conformidade de ASO, situação dos exames e previsto × realizado. */
export function BlocoExamesOcupacionais({
  dados,
}: {
  dados: Pick<DashboardSst, "donutLegend" | "pctEmDia" | "kpi" | "exames">;
}) {
  const { exames } = dados;
  return (
    <section className="space-y-2">
      <SectionTitle>Exames Ocupacionais</SectionTitle>
      <div className="grid gap-2 lg:grid-cols-[auto_1fr]">
        <Card className="flex flex-wrap items-center gap-4 px-3 py-2.5">
          <DonutStatus segmentos={dados.donutLegend} pctEmDia={dados.pctEmDia} />
          <div className="flex flex-col gap-1.5">
            {dados.donutLegend.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-[12px] text-foreground">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                {item.label} · <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </Card>
        <div className="flex flex-col gap-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <KpiTile titulo="Exames em dia" valor={dados.kpi.asoEmDia} tone="success" />
            <KpiTile titulo="A vencer (60 dias)" valor={dados.kpi.aVencer} tone="warning" />
            <KpiTile titulo="Vencidos + revisão" valor={dados.kpi.pendencias} tone="danger" destaque />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <KpiTile titulo="Previsto (matriz)" valor={formatarMoeda(exames.previsto)} />
            <KpiTile titulo="Realizado (lançados)" valor={formatarMoeda(exames.realizado)} />
            <KpiTile
              titulo="Diferença"
              valor={`${exames.dif >= 0 ? "+" : "−"} ${formatarMoeda(Math.abs(exames.dif))}`}
              tone={exames.dif > 0 ? "danger" : "success"}
            />
          </div>
        </div>
      </div>
      <p className="text-[10.5px] text-foreground-muted">
        Previsto: valor do exame na matriz ocupacional × cargos ({exames.examesComValor} de {exames.catExamesCount} exames com
        valor). Realizado: {exames.examesRealizadosCount} exame(s) lançado(s) nas fichas.
        {!exames.hasPrevisto && " Cadastre o valor dos exames na matriz ocupacional para alimentar o previsto."}
      </p>
    </section>
  );
}
