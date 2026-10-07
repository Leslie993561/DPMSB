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

interface MesOrcamento {
  mes: number;
  aprovado: number;
  utilizado: number;
  gap: number;
  saving: number;
}

interface EventoResumo {
  id: number;
  data: string;
  titulo: string;
}

/**
 * Resumo do Portal DHO na home — mesmo padrão do Portal DP: busca nas mesmas
 * APIs do Endomarketing (Orçamento/Calendário), então os números batem com o
 * que o módulo mostra. Falha da API (gestor sem acesso ao DHO) só zera o
 * cartão, não quebra a home.
 */
export function PortalDhoResumo() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const [mes, setMes] = useState(hoje.getMonth() + 1);

  const [orcamento, setOrcamento] = useState<MesOrcamento[] | null>(null);
  const [eventos, setEventos] = useState<EventoResumo[] | null>(null);

  useEffect(() => {
    fetch(`/api/dho/orcamento?ano=${ano}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { meses: MesOrcamento[] }) => setOrcamento(d.meses))
      .catch(() => setOrcamento([]));

    fetch(`/api/dho/eventos?ano=${ano}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { eventos: EventoResumo[] }) => setEventos(d.eventos))
      .catch(() => setEventos([]));
  }, [ano]);

  const orcadoPorTrimestre: TrimestreValor[] | null = orcamento
    ? ([1, 2, 3, 4] as const).map((q) => {
        const doTrimestre = orcamento.slice((q - 1) * 3, q * 3);
        const utilizado = doTrimestre.reduce((acc, m) => acc + m.utilizado, 0);
        const aprovado = doTrimestre.reduce((acc, m) => acc + m.aprovado, 0);
        return { trimestre: q, valor: utilizado, detalhe: `aprovado ${formatarMoeda(aprovado)}` };
      })
    : null;

  const mesSelecionado = orcamento?.find((m) => m.mes === mes) ?? null;
  const eventosDoMes = eventos?.filter((e) => Number(e.data.slice(5, 7)) === mes) ?? [];

  return (
    <section className="w-full rounded-xl border border-brand-surface bg-background p-5 dark:border-brand-neutral/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-foreground">Portal ENDO</h2>
          <p className="mt-0.5 text-sm text-foreground-muted">Desenvolvimento Humano e Organizacional.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-bold tracking-wide text-foreground-muted uppercase">Ações no ano</p>
            <p className="text-2xl font-bold text-brand-primary-800">{eventos ? eventos.length : "—"}</p>
          </div>
          <Link
            href="/dho"
            className="rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover"
          >
            Abrir →
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <BlocoTrimestres titulo={`Orçamento (realizado) · ${ano}`} href="/dho/endomarketing?aba=orcamento" dados={orcadoPorTrimestre} />

        <div className="rounded-lg border border-hairline p-3">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/dho/endomarketing?aba=orcamento"
              className="text-[11px] font-bold tracking-wide text-foreground-muted uppercase hover:text-brand-primary-800"
            >
              Custo do mês
            </Link>
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
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
            {!orcamento ? "…" : mesSelecionado ? formatarMoeda(mesSelecionado.utilizado) : "—"}
          </p>
          <p className="text-[11px] text-foreground-muted">
            {!orcamento
              ? "Carregando..."
              : mesSelecionado
                ? `Aprovado ${formatarMoeda(mesSelecionado.aprovado)} · ${
                    mesSelecionado.gap < 0
                      ? `gap ${formatarMoeda(mesSelecionado.gap)}`
                      : mesSelecionado.saving > 0
                        ? `saving ${formatarMoeda(mesSelecionado.saving)}`
                        : "sem diferença"
                  }`
                : "Sem dados para este mês"}
          </p>
        </div>

        <div className="rounded-lg border border-hairline p-3">
          <Link
            href="/dho/endomarketing?aba=calendario"
            className="text-[11px] font-bold tracking-wide text-foreground-muted uppercase hover:text-brand-primary-800"
          >
            Ações · {MESES[mes - 1]}
          </Link>
          <p className="mt-3 text-2xl font-bold text-brand-primary-800">{!eventos ? "…" : eventosDoMes.length}</p>
          <div className="mt-1 flex flex-col gap-0.5">
            {!eventos ? (
              <p className="text-[11px] text-foreground-muted">Carregando...</p>
            ) : eventosDoMes.length === 0 ? (
              <p className="text-[11px] text-foreground-muted">Nenhuma ação lançada neste mês.</p>
            ) : (
              eventosDoMes.slice(0, 2).map((e) => (
                <p key={e.id} className="truncate text-[11px] text-foreground-muted">
                  · {e.titulo}
                </p>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
