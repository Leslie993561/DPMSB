"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Card } from "@/components/shared/Card";
import { Badge } from "@/components/shared/Badge";
import { CabecalhoFiltravel, CampoTexto, COR_VINCULO } from "@/components/modules/colaboradores/ColaboradoresTable";
import { FichaEpiDrawer } from "./FichaEpiDrawer";
import { formatarMoeda } from "@/lib/format";
import type { Vinculo } from "@/lib/db/colaboradores";
import type { ColaboradorEpi, CustoTrimestre, FuncaoEpi, LinhaCustoEpi, LinhaCustoFardamento } from "@/lib/sst/epi";

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
  fardamento,
}: {
  aba: AbaEpi;
  colaboradores: ColaboradorEpi[];
  matriz: FuncaoEpi[];
  custos: { trimestres: CustoTrimestre[]; linhas: LinhaCustoEpi[] };
  fardamento: LinhaCustoFardamento[];
}) {
  const router = useRouter();
  // Busca fica aqui, fora da aba: continua valendo ao trocar de aba e voltar.
  const [busca, setBusca] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="flex w-60 items-center gap-1.5 rounded-full border border-hairline bg-background px-2.5 py-1 focus-within:border-brand-primary">
          <span aria-hidden className="text-[11px] text-foreground-muted">🔍</span>
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              if (aba !== "colaboradores") router.push("/sst/epi?aba=colaboradores");
            }}
            placeholder="Pesquisar colaborador"
            aria-label="Pesquisar colaborador"
            className="min-w-0 flex-1 bg-transparent text-[11.5px] text-foreground outline-none"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              aria-label="Limpar pesquisa"
              className="text-[11px] text-foreground-muted hover:text-foreground"
            >
              ✕
            </button>
          )}
        </label>
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

      {aba === "colaboradores" && (
        <ColaboradoresTab colaboradores={colaboradores} precos={custos.linhas} busca={busca} onBusca={setBusca} />
      )}
      {aba === "matriz" && <MatrizTab matriz={matriz} />}
      {aba === "custos" && <CustosTab custos={custos} fardamento={fardamento} />}
    </div>
  );
}

function ColaboradoresTab({
  colaboradores,
  precos,
  busca,
  onBusca,
}: {
  colaboradores: ColaboradorEpi[];
  precos: { epi: string; ca: string; valorUnitario: number }[];
  busca: string;
  onBusca: (v: string) => void;
}) {
  const [fichaAberta, setFichaAberta] = useState<ColaboradorEpi | null>(null);
  const [colunaAberta, setColunaAberta] = useState<"vinculo" | "texto" | null>(null);
  const [filtroVinculo, setFiltroVinculo] = useState<string>("");

  const vinculosDisponiveis = Array.from(
    new Set(colaboradores.map((c) => c.vinculo).filter((v): v is Vinculo => Boolean(v))),
  ).sort();

  const termo = busca.trim().toLowerCase();
  const filtrados = colaboradores.filter((c) => {
    if (filtroVinculo && c.vinculo !== filtroVinculo) return false;
    if (termo && ![c.nome, c.cargo, c.departamento].some((v) => v?.toLowerCase().includes(termo))) return false;
    return true;
  });

  return (
    <Card className="overflow-hidden p-0">
      <div className="max-h-[calc(100vh-180px)] overflow-x-auto overflow-y-auto">
        <table className="w-full text-[11.5px]">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-hairline bg-surface-page text-left text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">
              <CabecalhoFiltravel
                label="Vínculo"
                aberta={colunaAberta === "vinculo"}
                ativo={Boolean(filtroVinculo)}
                onToggle={() => setColunaAberta(colunaAberta === "vinculo" ? null : "vinculo")}
                onFechar={() => setColunaAberta(null)}
              >
                <div className="flex flex-col items-start gap-1">
                  {["", ...vinculosDisponiveis].map((v) => (
                    <button
                      key={v || "todos"}
                      type="button"
                      onClick={() => {
                        setFiltroVinculo(v);
                        setColunaAberta(null);
                      }}
                      className={filtroVinculo === v ? "font-semibold text-brand-primary-800" : "text-foreground-muted"}
                    >
                      {v || "Todos"}
                    </button>
                  ))}
                </div>
              </CabecalhoFiltravel>
              <CabecalhoFiltravel
                label="Colaborador / Cargo · Setor"
                aberta={colunaAberta === "texto"}
                ativo={Boolean(busca)}
                onToggle={() => setColunaAberta(colunaAberta === "texto" ? null : "texto")}
                onFechar={() => setColunaAberta(null)}
              >
                <CampoTexto valor={busca} onChange={onBusca} placeholder="Buscar nome, cargo ou setor" />
              </CabecalhoFiltravel>
              <th className="px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-foreground-muted">
                  Nenhum colaborador encontrado.
                </td>
              </tr>
            ) : (
              filtrados.map((c) => (
                <tr key={c.id} className="border-b border-hairline/70 last:border-0 hover:bg-surface-page/60">
                  <td className="w-20 px-3 py-1">
                    {c.vinculo ? <Badge cor={COR_VINCULO[c.vinculo]}>{c.vinculo}</Badge> : "—"}
                  </td>
                  <td className="px-3 py-1">
                    <div className="font-medium text-foreground uppercase">{c.nome}</div>
                    <div className="text-[10px] text-foreground-muted">
                      {c.cargo ?? "—"} · {c.departamento ?? "—"}
                    </div>
                  </td>
                  <td className="px-2 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => setFichaAberta(c)}
                      aria-label={`Ficha de ${c.nome}`}
                      title="Ficha do colaborador"
                      className="rounded px-1.5 py-0.5 text-foreground-muted hover:bg-brand-surface hover:text-foreground"
                    >
                      ⋮
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <FichaEpiDrawer colaborador={fichaAberta} catalogo={precos.map((p) => ({ epi: p.epi, ca: p.ca }))} onFechar={() => setFichaAberta(null)} />
    </Card>
  );
}

function MatrizTab({ matriz }: { matriz: FuncaoEpi[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {matriz.map((f) => (
        <Card key={f.funcao} className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-primary-100 text-brand-primary-800">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                <path fillRule="evenodd" clipRule="evenodd" d="M10 2 3 5v5c0 4.42 2.98 8.1 7 9 4.02-.9 7-4.58 7-9V5l-7-3Zm-1.2 11.2L5.6 10l1.4-1.4 1.8 1.8L14 6.2l1.4 1.4-6.6 5.6Z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-semibold text-foreground">{f.funcao}</p>
              <p className="text-[10.5px] text-foreground-muted">{f.epis.length} EPIs</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {f.epis.map((epi) => (
              <span
                key={epi}
                className="flex items-center gap-1 rounded-full border border-hairline bg-surface-page px-2 py-0.5 text-[10.5px] text-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
                {epi}
              </span>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function CustosTab({
  custos,
  fardamento,
}: {
  custos: { trimestres: CustoTrimestre[]; linhas: LinhaCustoEpi[] };
  fardamento: LinhaCustoFardamento[];
}) {
  const totalFardamento = fardamento.reduce((acc, l) => acc + l.valorTotal, 0);
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

      <div className="space-y-2">
        <h2 className="text-[10px] font-bold tracking-[0.16em] text-foreground-muted uppercase">Fardamento</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-hairline bg-background text-left font-bold tracking-wide text-foreground-muted uppercase">
                <th className="px-3 py-2 text-[10.5px]">Item</th>
                <th className="px-3 py-2 text-right text-[10.5px]">Quantidade</th>
                <th className="px-3 py-2 text-right text-[10.5px]">Valor unitário</th>
                <th className="px-3 py-2 text-right text-[10.5px]">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {fardamento.map((l) => (
                <tr key={l.tipo} className="border-t border-hairline/60">
                  <td className="px-3 py-1.5 font-semibold text-foreground">{l.tipo}</td>
                  <td className="px-3 py-1.5 text-right text-foreground">{l.quantidade}</td>
                  <td className="px-3 py-1.5 text-right text-foreground-muted">{formatarMoeda(l.valorUnitario)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-brand-primary-800">{formatarMoeda(l.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-hairline bg-background font-semibold">
                <td className="px-3 py-2 text-foreground" colSpan={3}>
                  Total geral
                </td>
                <td className="px-3 py-2 text-right text-brand-primary-800">{formatarMoeda(totalFardamento)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      </div>
    </div>
  );
}
