"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatarMoeda } from "@/lib/format";
import { BlocoTrimestres, type TrimestreValor } from "./BlocoTrimestres";

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

/**
 * Resumo do Portal DP na home. Busca nas mesmas APIs dos dashboards de Férias,
 * Breakdown e Benefícios — os números batem com o que cada módulo mostra. Uma
 * API que falhe (ex.: gestor sem permissão no módulo) só zera aquele bloco.
 */
export function PortalDpResumo() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const [mesFolha, setMesFolha] = useState(hoje.getMonth() + 1);

  const [colaboradores, setColaboradores] = useState<number | null>(null);
  const [ferias, setFerias] = useState<TrimestreValor[] | null>(null);
  const [beneficios, setBeneficios] = useState<TrimestreValor[] | null>(null);
  const [folha, setFolha] = useState<{ custo: number; colaboradores: number } | null>(null);
  const [carregandoFolha, setCarregandoFolha] = useState(true);

  useEffect(() => {
    fetch(`/api/dashboard/ferias?ano=${ano}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { empregadosAtivos: number; porTrimestre: { trimestre: 1 | 2 | 3 | 4; valorPago: number; encargos: number; colaboradores: number }[] }) => {
        setColaboradores(d.empregadosAtivos);
        setFerias(
          d.porTrimestre.map((t) => ({
            trimestre: t.trimestre,
            valor: t.valorPago,
            detalhe: `${t.colaboradores} colab. · encargos ${formatarMoeda(t.encargos)}`,
          })),
        );
      })
      .catch(() => setFerias([]));

    fetch(`/api/beneficios/resumo-anual?ano=${ano}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { meses: { mes: number; total: number }[] }) => {
        const porTrimestre: TrimestreValor[] = ([1, 2, 3, 4] as const).map((q) => ({
          trimestre: q,
          valor: d.meses.filter((m) => Math.ceil(m.mes / 3) === q).reduce((acc, m) => acc + m.total, 0),
        }));
        setBeneficios(porTrimestre);
      })
      .catch(() => setBeneficios([]));
  }, [ano]);

  useEffect(() => {
    setCarregandoFolha(true);
    const competencia = `${ano}-${String(mesFolha).padStart(2, "0")}`;
    fetch(`/api/folha-breakdown?competencia=${competencia}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { linhas: { custoTotal: number }[] }) =>
        setFolha({ custo: d.linhas.reduce((acc, l) => acc + l.custoTotal, 0), colaboradores: d.linhas.length }),
      )
      .catch(() => setFolha(null))
      .finally(() => setCarregandoFolha(false));
  }, [ano, mesFolha]);

  return (
    <section className="w-full rounded-xl border border-brand-surface bg-background p-5 dark:border-brand-neutral/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-foreground">Portal DP</h2>
          <p className="mt-0.5 text-sm text-foreground-muted">Departamento Pessoal: férias, folha, colaboradores e rescisão.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-bold tracking-wide text-foreground-muted uppercase">Colaboradores ativos</p>
            <p className="text-2xl font-bold text-brand-primary-800">{colaboradores ?? "—"}</p>
          </div>
          <Link
            href="/dashboard"
            className="rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover"
          >
            Abrir →
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <BlocoTrimestres titulo={`Férias · ${ano}`} href="/dashboard" dados={ferias} />

        <div className="rounded-lg border border-hairline p-3">
          <div className="flex items-center justify-between gap-2">
            <Link href="/folha" className="text-[11px] font-bold tracking-wide text-foreground-muted uppercase hover:text-brand-primary-800">
              Breakdown · custo da folha
            </Link>
            <select
              value={mesFolha}
              onChange={(e) => setMesFolha(Number(e.target.value))}
              className="rounded border border-hairline bg-background px-1.5 py-0.5 text-[11.5px] text-foreground outline-none"
            >
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-3 text-2xl font-bold text-brand-primary-800">
            {carregandoFolha ? "…" : folha ? formatarMoeda(folha.custo) : "—"}
          </p>
          <p className="text-[11px] text-foreground-muted">
            {carregandoFolha
              ? "Carregando..."
              : folha
                ? `${MESES[mesFolha - 1]}/${ano} · ${folha.colaboradores} colaborador(es)`
                : "Sem dados para este mês"}
          </p>
        </div>

        <BlocoTrimestres titulo={`Benefícios · ${ano}`} href="/beneficios" dados={beneficios} />
      </div>
    </section>
  );
}
