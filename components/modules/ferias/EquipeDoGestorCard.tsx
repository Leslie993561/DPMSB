"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/shared/Card";
import { useSessaoResumo } from "@/lib/authClient";
import { formatarDataBr } from "@/lib/format";
import type { ItemProgramacaoFerias } from "@/lib/db/programacaoFerias";

interface Pessoa {
  id: number;
  nome: string;
  cargo: string | null;
  departamento: string | null;
}

/**
 * Painel do gestor no Planejamento de Férias: ele mesmo e quem ele lidera,
 * com a situação de cada um no ano e o atalho para programar — aparece mesmo
 * quando ninguém tem férias programadas ainda (a tabela abaixo só lista quem tem).
 */
export function EquipeDoGestorCard({
  ano,
  itens,
  onProgramar,
}: {
  ano: number;
  itens: ItemProgramacaoFerias[];
  onProgramar: (colaboradorId: number) => void;
}) {
  const sessao = useSessaoResumo();
  const [equipe, setEquipe] = useState<Pessoa[]>([]);

  useEffect(() => {
    fetch("/api/colaboradores")
      .then((r) => r.json())
      .then((d: { colaboradores?: (Pessoa & { status?: string })[] }) =>
        setEquipe(
          (d.colaboradores ?? [])
            .filter((c) => c.status !== "desligado")
            .map((c) => ({
              id: c.id,
              nome: c.nome,
              cargo: c.cargo,
              departamento: c.departamento,
            })),
        ),
      )
      .catch(() => setEquipe([]));
  }, []);

  const pessoas = useMemo<(Pessoa & { eu: boolean })[]>(() => {
    const meuId = sessao?.colaboradorId ?? null;
    const outros = equipe
      .filter((p) => p.id !== meuId)
      .sort((a, b) => a.nome.localeCompare(b.nome));
    const eu = meuId
      ? [
          {
            id: meuId,
            nome: sessao?.nome ?? "Eu",
            cargo: sessao?.cargo ?? null,
            departamento: null,
            eu: true,
          },
        ]
      : [];
    return [...eu, ...outros.map((p) => ({ ...p, eu: false }))];
  }, [equipe, sessao]);

  if (pessoas.length === 0) return null;

  return (
    <Card className="p-4">
      <p className="mb-2 text-[12px] font-bold tracking-wide text-foreground-muted uppercase">
        Minha equipe · férias {ano}
      </p>
      <div className="divide-y divide-hairline/70 rounded border border-hairline">
        {pessoas.map((p) => {
          const programadas = itens
            .filter((i) => i.colaboradorId === p.id && i.ano === ano)
            .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));
          return (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-foreground">
                  {p.nome}
                  {p.eu && (
                    <span className="ml-1.5 rounded bg-brand-primary-100/60 px-1.5 py-0.5 text-[10px] font-semibold text-brand-primary-800">
                      eu
                    </span>
                  )}
                </p>
                <p className="truncate text-[11px] text-foreground-muted">
                  {[p.cargo, p.departamento].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <p className="text-[11.5px] text-foreground-muted">
                {programadas.length === 0
                  ? "Sem férias programadas"
                  : programadas
                      .map(
                        (i) => `${formatarDataBr(i.dataInicio)} (${i.dias + (i.abono ? i.diasAbono : 0)}d)`,
                      )
                      .join(" · ")}
              </p>
              <button
                type="button"
                onClick={() => onProgramar(p.id)}
                className="rounded bg-brand-primary px-2.5 py-1 text-[11px] font-medium text-brand-white hover:bg-brand-primary-hover"
              >
                Programar
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
