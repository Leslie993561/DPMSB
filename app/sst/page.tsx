import { redirect } from "next/navigation";
import Link from "next/link";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { obterDashboardSst } from "@/lib/sst/dashboard";
import { formatarMoeda } from "@/lib/format";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/shared/Card";
import {
  BlocoExamesOcupacionais,
  BlocoGestaoEpi,
  SectionTitle,
  TabelaRanking,
} from "@/components/modules/sst/BlocosSst";

export const metadata = { title: "Dashboard SST — Portal Recursos Humanos" };

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

      <BlocoGestaoEpi fichasEpi={data.fichasEpi} custoEpi={data.custoEpi} />

      <BlocoExamesOcupacionais dados={data} />

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

    </div>
  );
}
