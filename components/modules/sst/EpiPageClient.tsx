"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Card } from "@/components/shared/Card";
import { formatarMoeda } from "@/lib/format";
import type { ColaboradorEpi, CustoTrimestre, FuncaoEpi, LinhaCustoEpi } from "@/lib/sst/epi";

export type AbaEpi = "colaboradores" | "matriz" | "custos";

const ABAS: { id: AbaEpi; label: string }[] = [
  { id: "colaboradores", label: "Colaboradores" },
  { id: "matriz", label: "Matriz de EPI" },
  { id: "custos", label: "Custo e Valores" },
];

export function EpiPageClient({
  aba,
  colaboradores,
  matriz,
  custos,
}: {
  aba: AbaEpi;
  colaboradores: ColaboradorEpi[];
  matriz: FuncaoEpi[];
  custos: { trimestres: CustoTrimestre[]; linhas: LinhaCustoEpi[] };
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {ABAS.map((a) => (
          <Link
            key={a.id}
            href={`/sst/epi?aba=${a.id}`}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors",
              aba === a.id
                ? "border-brand-primary/50 bg-brand-primary-100 text-brand-primary-800"
                : "border-hairline bg-background text-foreground hover:border-brand-primary hover:bg-brand-primary-050 hover:text-brand-primary-800",
            )}
          >
            {a.label}
          </Link>
        ))}
      </div>

      {aba === "colaboradores" && <ColaboradoresTab colaboradores={colaboradores} />}
      {aba === "matriz" && <MatrizTab matriz={matriz} />}
      {aba === "custos" && <CustosTab custos={custos} />}
    </div>
  );
}

function MenuFicha() {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label="Mais opções"
        className="rounded px-1.5 py-0.5 text-foreground-muted hover:bg-brand-surface hover:text-foreground"
      >
        ⋮
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setAberto(false)} />
          <div className="absolute top-full right-0 z-30 mt-1 w-40 rounded-md border border-hairline bg-background p-1 shadow-drawer">
            {/* Sem ação ainda — a ficha de entrega depende de uma aba de fichas/histórico que ainda não existe. */}
            <span className="block cursor-not-allowed rounded px-2 py-1.5 text-[12px] text-foreground-muted/50">
              Enviar ficha
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function ColaboradoresTab({ colaboradores }: { colaboradores: ColaboradorEpi[] }) {
  if (colaboradores.length === 0) {
    return (
      <Card className="p-6 text-center text-[12px] text-foreground-muted">Nenhum colaborador ativo cadastrado.</Card>
    );
  }
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-hairline bg-background text-left font-bold tracking-wide text-foreground-muted uppercase">
            <th className="px-3 py-2 text-[10.5px]">Nome</th>
            <th className="px-3 py-2 text-[10.5px]">Cargo</th>
            <th className="px-3 py-2 text-[10.5px]">Departamento</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {colaboradores.map((c) => (
            <tr key={c.id} className="border-t border-hairline/60">
              <td className="px-3 py-1.5 font-semibold text-foreground">{c.nome}</td>
              <td className="px-3 py-1.5 text-foreground-muted">{c.cargo ?? "—"}</td>
              <td className="px-3 py-1.5 text-foreground-muted">{c.departamento ?? "—"}</td>
              <td className="px-2 py-1.5 text-right">
                <MenuFicha />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function MatrizTab({ matriz }: { matriz: FuncaoEpi[] }) {
  const [selecionada, setSelecionada] = useState<string | null>(null);

  return (
    <div className="grid gap-4 sm:grid-cols-[260px_1fr]">
      <Card className="flex flex-col gap-0.5 p-2">
        {matriz.map((f) => {
          const ativa = f.funcao === selecionada;
          return (
            <button
              key={f.funcao}
              type="button"
              onClick={() => setSelecionada(ativa ? null : f.funcao)}
              className={
                "flex items-center justify-between rounded-md px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors " +
                (ativa
                  ? "bg-brand-primary-100 text-brand-primary-800"
                  : "text-foreground hover:bg-surface-page")
              }
            >
              <span>{f.funcao}</span>
              <span className="text-[10.5px] text-foreground-muted">{f.epis.length}</span>
            </button>
          );
        })}
      </Card>

      <Card className="p-4">
        {!selecionada ? (
          <p className="text-[12px] text-foreground-muted">
            Selecione uma função à esquerda para ver os EPIs obrigatórios.
          </p>
        ) : (
          (() => {
            const entrada = matriz.find((f) => f.funcao === selecionada);
            if (!entrada) return null;
            return (
              <div className="space-y-3">
                <div>
                  <h3 className="text-[13px] font-semibold text-foreground">{entrada.funcao}</h3>
                  <p className="text-[11px] text-foreground-muted">{entrada.epis.length} EPI(s) obrigatório(s)</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {entrada.epis.map((epi) => (
                    <span
                      key={epi}
                      className="flex items-center gap-1.5 rounded-full border border-hairline bg-background px-2.5 py-1 text-[11px] text-foreground"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
                      {epi}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()
        )}
      </Card>
    </div>
  );
}

function CustosTab({ custos }: { custos: { trimestres: CustoTrimestre[]; linhas: LinhaCustoEpi[] } }) {
  const totalGeral = custos.linhas.reduce((acc, l) => acc + l.valorTotal, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {custos.trimestres.map((t) => (
          <Card key={t.label} className="p-3">
            <p className="text-[10px] font-bold tracking-wide text-foreground-muted uppercase">{t.label}</p>
            <p className="mt-1 text-lg font-bold text-brand-primary-800">{formatarMoeda(t.valor)}</p>
            <p className="text-[11px] text-foreground-muted">{t.quantidade} entregue(s)</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-hairline bg-background text-left font-bold tracking-wide text-foreground-muted uppercase">
              <th className="px-3 py-2 text-[10.5px]">EPI</th>
              <th className="px-3 py-2 text-right text-[10.5px]">Quantidade</th>
              <th className="px-3 py-2 text-right text-[10.5px]">Valor unitário</th>
              <th className="px-3 py-2 text-right text-[10.5px]">Valor total</th>
            </tr>
          </thead>
          <tbody>
            {custos.linhas.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-foreground-muted">
                  Nenhum EPI cadastrado no catálogo de preços ainda.
                </td>
              </tr>
            ) : (
              custos.linhas.map((l) => (
                <tr key={l.epi} className="border-t border-hairline/60">
                  <td className="px-3 py-1.5 font-semibold text-foreground">{l.epi}</td>
                  <td className="px-3 py-1.5 text-right text-foreground">{l.quantidade}</td>
                  <td className="px-3 py-1.5 text-right text-foreground-muted">{formatarMoeda(l.valorUnitario)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-brand-primary-800">
                    {formatarMoeda(l.valorTotal)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {custos.linhas.length > 0 && (
            <tfoot>
              <tr className="border-t border-hairline bg-background font-semibold">
                <td className="px-3 py-2 text-foreground" colSpan={3}>
                  Total geral
                </td>
                <td className="px-3 py-2 text-right text-brand-primary-800">{formatarMoeda(totalGeral)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
    </div>
  );
}
