"use client";

import { useEffect, useMemo, useState } from "react";
import { formatarMoeda } from "@/lib/format";
import { Card } from "@/components/shared/Card";
import { RiskCallout } from "@/components/shared/RiskCallout";
import { cn } from "@/lib/cn";

interface VerbaColaborador {
  colaboradorId: number;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  vinculo: string | null;
  salarioBase: number;
  inss: number;
  irrf: number;
  fgts: number;
  provisaoDecimoTerceiro: number;
  valeTransporte: number;
  valeAlimentacao: number;
  vm: number | null;
  odontologico: number | null;
  solides: number | null;
  flash: number | null;
  bonificacao: number | null;
  outrosCustos: number | null;
  premiacao: number;
  custoTotal: number;
}

interface ResumoTrimestre {
  trimestre: 1 | 2 | 3 | 4;
  custoTotal: number;
  colaboradores: number;
  projecao: boolean;
  mesesLancados: number;
  porVinculo: { vinculo: string; custoTotal: number }[];
}

const NOMES_MES = [
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
  1: "jan · fev · mar",
  2: "abr · mai · jun",
  3: "jul · ago · set",
  4: "out · nov · dez",
};

function competenciaAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function competenciaExibida(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return `${NOMES_MES[mes - 1]}/${ano}`;
}

interface ResumoGrupo {
  colaboradores: number;
  salarial: number;
  encargos: number;
  beneficios: number;
  premiacao: number;
  custoTotal: number;
}

/** VT/VA + extras do tipo "benefício" (VM, odontológico, plataformas) importadas para o mês. */
/**
 * Só dois regimes importam no custo: quem é empregado e quem é prestador.
 *
 * O cadastro escreve o vínculo de várias formas — "CLT", "CLT - bio", "JÁ"
 * (jovem aprendiz), "EST" (estagiário) e às vezes nada. Todas são contratação
 * com encargos; agrupá-las pelo texto literal deixava dez pessoas fora da
 * conta de CLT. PJ é o único caso à parte: recebe nota, não folha.
 */
function ehPjVinculo(vinculo: string | null): boolean {
  return (vinculo ?? "").trim().toUpperCase() === "PJ";
}

function totalBeneficios(l: VerbaColaborador): number {
  return l.valeTransporte + l.valeAlimentacao + (l.vm ?? 0) + (l.odontologico ?? 0) + (l.solides ?? 0) + (l.flash ?? 0);
}

/** Premiação + bonificação + outros custos importados para o mês. */
function totalPremiacaoExtras(l: VerbaColaborador): number {
  return l.premiacao + (l.bonificacao ?? 0) + (l.outrosCustos ?? 0);
}

function resumirGrupo(itens: VerbaColaborador[]): ResumoGrupo {
  return itens.reduce(
    (acc, l) => ({
      colaboradores: acc.colaboradores + 1,
      salarial: acc.salarial + l.salarioBase,
      encargos: acc.encargos + l.fgts + l.provisaoDecimoTerceiro,
      beneficios: acc.beneficios + totalBeneficios(l),
      premiacao: acc.premiacao + totalPremiacaoExtras(l),
      custoTotal: acc.custoTotal + l.custoTotal,
    }),
    { colaboradores: 0, salarial: 0, encargos: 0, beneficios: 0, premiacao: 0, custoTotal: 0 },
  );
}

export function BreakdownDashboardTab() {
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [linhas, setLinhas] = useState<VerbaColaborador[]>([]);
  const [fechado, setFechado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [fechando, setFechando] = useState(false);
  const [leitura, setLeitura] = useState<string | null>(null);
  const [leituraErro, setLeituraErro] = useState<string | null>(null);
  const [gerandoLeitura, setGerandoLeitura] = useState(false);
  const [trimestres, setTrimestres] = useState<ResumoTrimestre[]>([]);

  const ano = Number(competencia.split("-")[0]);

  async function recarregar() {
    try {
      const res = await fetch(`/api/folha-breakdown?competencia=${competencia}`);
      const data = await res.json();
      setLinhas(data.linhas ?? []);
      setFechado(Boolean(data.fechado));
      setLeitura(null);
      setLeituraErro(null);
    } finally {
      setCarregando(false);
    }
  }

  async function recarregarTrimestres() {
    const res = await fetch(`/api/folha-breakdown/trimestres?ano=${ano}`);
    const data = await res.json();
    setTrimestres(data.trimestres ?? []);
  }

  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca de dados ao trocar de competência; setState só ocorre após o await do fetch
    void recarregarTrimestres();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencia]);

  const filtrados = linhas;

  const totais = useMemo(() => resumirGrupo(filtrados), [filtrados]);

  // Duas linhas fixas: CLT (com jovem aprendiz e estagiário) e PJ. Antes eram
  // as grafias literais do cadastro, e quem estava como "CLT - bio", "JÁ" ou
  // "EST" não aparecia em nenhuma das duas.
  const linhasVinculo = useMemo(() => {
    const grupos = [
      { rotulo: "CLT", itens: filtrados.filter((l) => !ehPjVinculo(l.vinculo)) },
      { rotulo: "PJ", itens: filtrados.filter((l) => ehPjVinculo(l.vinculo)) },
    ];
    return grupos
      .filter((g) => g.itens.length > 0)
      .map((g) => ({
        rotulo: g.rotulo,
        colaboradores: g.itens.length,
        custo: g.itens.reduce((soma, l) => soma + l.custoTotal, 0),
      }));
  }, [filtrados]);

  const maxLinhaVinculo = Math.max(1, ...linhasVinculo.map((l) => l.custo));

  const porSetor = useMemo(() => {
    const mapa = new Map<string, { folha: number; beneficios: number }>();
    for (const l of filtrados) {
      const chave = l.departamento ?? "Sem setor";
      const atual = mapa.get(chave) ?? { folha: 0, beneficios: 0 };
      mapa.set(chave, {
        folha: atual.folha + l.salarioBase + l.fgts + l.provisaoDecimoTerceiro + totalPremiacaoExtras(l),
        beneficios: atual.beneficios + totalBeneficios(l),
      });
    }
    return Array.from(mapa.entries())
      .map(([setor, v]) => ({ setor, ...v }))
      .sort((a, b) => b.folha + b.beneficios - (a.folha + a.beneficios));
  }, [filtrados]);

  const cltItens = useMemo(() => filtrados.filter((l) => !ehPjVinculo(l.vinculo)), [filtrados]);
  const pjItens = useMemo(() => filtrados.filter((l) => ehPjVinculo(l.vinculo)), [filtrados]);

  const resumoCLT = useMemo(() => resumirGrupo(cltItens), [cltItens]);
  const resumoPJ = useMemo(() => resumirGrupo(pjItens), [pjItens]);

  const trimestreCLT = useMemo(
    () =>
      trimestres.map((t) => ({
        trimestre: t.trimestre,
        custo: t.porVinculo.filter((pv) => !ehPjVinculo(pv.vinculo)).reduce((s, pv) => s + pv.custoTotal, 0),
        projecao: t.projecao,
        mesesLancados: t.mesesLancados,
      })),
    [trimestres],
  );
  const trimestrePJ = useMemo(
    () =>
      trimestres.map((t) => ({
        trimestre: t.trimestre,
        custo: t.porVinculo.filter((pv) => ehPjVinculo(pv.vinculo)).reduce((s, pv) => s + pv.custoTotal, 0),
        projecao: t.projecao,
        mesesLancados: t.mesesLancados,
      })),
    [trimestres],
  );
  const trimestresExibidos = useMemo(
    () => trimestres.map((t) => ({ ...t, custoExibido: t.custoTotal })),
    [trimestres],
  );
  const maxTrimestreExibido = Math.max(1, ...trimestresExibidos.map((t) => t.custoExibido));

  async function fecharMes() {
    setFechando(true);
    try {
      const res = await fetch("/api/folha-breakdown/fechar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competencia }),
      });
      if (res.ok) {
        await recarregar();
        await recarregarTrimestres();
      }
    } finally {
      setFechando(false);
    }
  }

  async function gerarLeitura() {
    setGerandoLeitura(true);
    setLeitura(null);
    setLeituraErro(null);
    try {
      const custoPorDepartamento = new Map<string, number>();
      for (const l of linhas) {
        const dep = l.departamento ?? "Sem departamento";
        custoPorDepartamento.set(dep, (custoPorDepartamento.get(dep) ?? 0) + l.custoTotal);
      }
      const res = await fetch("/api/ai/leitura-folha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competencia,
          totais: { colaboradores: linhas.length, custoTotal: resumirGrupo(linhas).custoTotal },
          porDepartamento: Array.from(custoPorDepartamento.entries()).map(([departamento, custoTotal]) => ({
            departamento,
            custoTotal,
          })),
        }),
      });
      const data = await res.json();
      if (data.indisponivel || !res.ok) {
        setLeituraErro(data.erro ?? "Não foi possível gerar a leitura.");
        return;
      }
      setLeitura(data.texto);
    } catch {
      setLeituraErro("Falha de comunicação com o servidor.");
    } finally {
      setGerandoLeitura(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex flex-col gap-1 text-xs text-foreground-muted">
          Competência
          <input
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            className="rounded-md border border-brand-surface bg-background px-3 py-1.5 text-sm text-foreground dark:border-brand-neutral/30"
          />
        </label>
        {fechado ? (
          <span className="rounded-full bg-status-success-bg px-2.5 py-1 text-xs font-semibold text-status-success">
            Mês fechado
          </span>
        ) : (
          <button
            type="button"
            onClick={fecharMes}
            disabled={fechando || linhas.length === 0}
            className="rounded-md bg-brand-primary px-3 py-1.5 text-xs font-semibold text-brand-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {fechando ? "Fechando..." : "Fechar mês"}
          </button>
        )}
        <button
          type="button"
          onClick={gerarLeitura}
          disabled={gerandoLeitura || linhas.length === 0}
          className="ml-auto rounded-md border border-brand-surface px-3 py-1.5 text-xs font-semibold text-foreground-muted transition-colors hover:border-brand-primary hover:text-brand-primary-800 disabled:opacity-50 dark:border-brand-neutral/30"
        >
          {gerandoLeitura ? "Gerando..." : "✨ Gerar leitura com IA"}
        </button>
      </div>

      {leitura && (
        <Card className="border-brand-accent/40 bg-brand-primary-050 p-4">
          <p className="mb-1 text-xs font-semibold tracking-wide text-brand-primary-800 uppercase">
            Leitura de IA — {competencia}
          </p>
          <p className="text-sm text-foreground">{leitura}</p>
        </Card>
      )}
      {leituraErro && <RiskCallout nivel="info">{leituraErro}</RiskCallout>}

      {carregando ? (
        <p className="text-sm text-foreground-muted">Carregando...</p>
      ) : linhas.length === 0 ? (
        <p className="rounded-xl border border-brand-surface bg-background p-5 text-sm text-foreground-muted dark:border-brand-neutral/30">
          Nenhum colaborador cadastrado para calcular o breakdown desta competência.
        </p>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="p-4">
              <span className="text-[13px] font-medium text-foreground">Todos</span>

              <p className="mt-3 text-[11px] font-medium tracking-wide text-foreground-muted uppercase">
                Custo total Caixa
              </p>
              <p className="text-[28px] leading-tight font-bold text-foreground">{formatarMoeda(totais.custoTotal)}</p>
              <p className="text-[11.5px] text-foreground-muted">
                competência {competenciaExibida(competencia)} · {totais.colaboradores} colaboradores
              </p>

              <p className="mt-4 text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">Por vínculo</p>
              <div className="mt-2 space-y-2">
                {linhasVinculo.map((l) => (
                  <div key={l.rotulo}>
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="text-foreground-muted">
                        {l.rotulo} · {l.colaboradores}
                      </span>
                      <span className="font-mono font-semibold text-foreground">{formatarMoeda(l.custo)}</span>
                    </div>
                    <div className="mt-1 h-[5px] w-full overflow-hidden rounded-full bg-brand-surface">
                      <div
                        className="h-full rounded-full bg-brand-primary/70"
                        style={{ width: `${(l.custo / maxLinhaVinculo) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
                Custo por trimestre — {ano}
              </p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {trimestresExibidos.map((t) => (
                  <div key={t.trimestre} className="rounded-md border border-hairline bg-surface-page p-2 text-center">
                    <div className="flex h-8 items-end justify-center">
                      <div
                        className="w-4 rounded-t bg-brand-primary/50"
                        style={{ height: `${Math.max(10, (t.custoExibido / maxTrimestreExibido) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10.5px] font-semibold text-foreground">Q{t.trimestre}</p>
                    <p className="text-[9px] text-foreground-muted">{FAIXA_TRIMESTRE[t.trimestre]}</p>
                    <p className="text-[10px] font-semibold text-foreground">{formatarMoeda(t.custoExibido)}</p>
                    {t.mesesLancados === 0 ? (
                      <p className="text-[10px] text-foreground-muted">sem folha lançada</p>
                    ) : t.mesesLancados < 3 ? (
                      <p className="text-[10px] text-foreground-muted">
                        {t.mesesLancados} de 3 meses lançados
                      </p>
                    ) : null}
                    {t.projecao && t.mesesLancados > 0 && (
                      <p className="mt-0.5 text-[8px] leading-tight text-foreground-muted">
                        projeção sobre a folha atual
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-hairline bg-surface-page px-4 py-2">
                <h3 className="text-[13px] font-medium text-foreground">Custo por setor</h3>
                <span className="rounded-full bg-brand-surface px-2 py-0.5 text-[9.5px] font-bold text-foreground-muted">
                  maior → menor
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-hairline/60 px-4 py-1.5 text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">
                <span>Setor</span>
                <div className="flex gap-4">
                  <span className="w-20 text-right">Folha</span>
                  <span className="w-20 text-right">Benefícios</span>
                  <span className="w-20 text-right">Total</span>
                </div>
              </div>
              <div>
                {porSetor.map((s) => (
                  <div
                    key={s.setor}
                    className="flex items-center justify-between border-b border-hairline/60 px-4 py-1.5 text-xs last:border-0"
                  >
                    <span className="text-foreground-muted">{s.setor}</span>
                    <div className="flex gap-4">
                      <span className="w-20 text-right text-[11px] text-foreground-muted [font-family:Arial,_Helvetica,_sans-serif]">
                        {formatarMoeda(s.folha)}
                      </span>
                      <span className="w-20 text-right text-[11px] text-foreground-muted [font-family:Arial,_Helvetica,_sans-serif]">
                        {formatarMoeda(s.beneficios)}
                      </span>
                      <span className="w-20 text-right text-[11px] font-bold text-foreground [font-family:Arial,_Helvetica,_sans-serif]">
                        {formatarMoeda(s.folha + s.beneficios)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {cltItens.length > 0 && (
              <VinculoDetalheCard
                titulo="CLT"
                badge="CLT, jovem aprendiz e estagiário"
                resumo={resumoCLT}
                trimestres={trimestreCLT}
                campos={[
                  { label: "Total salarial", valor: resumoCLT.salarial },
                  { label: "Total de encargos", valor: resumoCLT.encargos, tooltip: "FGTS, INSS, RAT" },
                  {
                    label: "Total de benefícios",
                    valor: resumoCLT.beneficios,
                    tooltip:
                      "Vale-transporte, Mobilidade, Vale-refeição (JÁ · CLT · EST), Plano odontológico, TotalPass, Flash, Sólides",
                  },
                ]}
              />
            )}
            {pjItens.length > 0 && (
              <VinculoDetalheCard
                titulo="PJ"
                badge="prestadores de serviço"
                resumo={resumoPJ}
                trimestres={trimestrePJ}
                campos={[
                  { label: "Total de bonificação fixa", valor: resumoPJ.salarial },
                  { label: "Total premiação do mês", valor: resumoPJ.premiacao },
                ]}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function VinculoDetalheCard({
  titulo,
  badge,
  resumo,
  trimestres,
  campos,
}: {
  titulo: string;
  badge: string;
  resumo: ResumoGrupo;
  trimestres: { trimestre: 1 | 2 | 3 | 4; custo: number; projecao: boolean }[];
  campos: { label: string; valor: number; tooltip?: string }[];
}) {
  const maxTrimestre = Math.max(1, ...trimestres.map((t) => t.custo));

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13.5px] font-bold text-foreground">{titulo}</h3>
        <span className="rounded-full bg-brand-surface px-2 py-0.5 text-[9.5px] font-semibold text-foreground-muted">
          {badge}
        </span>
      </div>

      <p className="mt-3 text-[10.5px] font-medium tracking-wide text-foreground-muted uppercase">
        Custo total da folha
      </p>
      <p className="text-xl font-bold text-foreground">{formatarMoeda(resumo.custoTotal)}</p>

      <div className="mt-2.5 flex items-center justify-between text-[11.5px]">
        <span className="text-foreground-muted">Colaboradores</span>
        <span className="font-mono font-semibold text-foreground">{resumo.colaboradores}</span>
      </div>
      {campos.map((c) => (
        <div key={c.label} className="flex items-center justify-between border-t border-hairline/60 py-1 text-[11.5px]">
          <span className={cn("text-foreground-muted", c.tooltip && "cursor-help underline decoration-dotted")} title={c.tooltip}>
            {c.label}
          </span>
          <span className="font-mono font-semibold text-foreground">{formatarMoeda(c.valor)}</span>
        </div>
      ))}

      <p className="mt-3 text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">
        Custo por trimestre 2026
      </p>
      <div className="mt-1.5 grid grid-cols-4 gap-1.5">
        {trimestres.map((t) => (
          <div key={t.trimestre} className="rounded border border-hairline bg-surface-page p-1.5 text-center">
            <div className="flex h-6 items-end justify-center">
              <div
                className="w-3 rounded-t bg-brand-primary/50"
                style={{ height: `${Math.max(10, (t.custo / maxTrimestre) * 100)}%` }}
              />
            </div>
            <p className="mt-0.5 text-[9px] font-semibold text-foreground">Q{t.trimestre}</p>
            <p className="text-[8.5px] text-foreground-muted">{formatarMoeda(t.custo)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
