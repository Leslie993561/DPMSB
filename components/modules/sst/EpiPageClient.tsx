"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Card } from "@/components/shared/Card";
import { Badge } from "@/components/shared/Badge";
import { Modal } from "@/components/shared/Modal";
import { CabecalhoFiltravel, CampoTexto, COR_VINCULO } from "@/components/modules/colaboradores/ColaboradoresTable";
import { FichaEpiDrawer } from "./FichaEpiDrawer";
import { formatarMoeda } from "@/lib/format";
import type { Vinculo } from "@/lib/db/colaboradores";
import type {
  ColaboradorEpi,
  CustoTrimestre,
  FuncaoEpi,
  LinhaCustoEpi,
  LinhaCustoFardamento,
  SituacaoEpi,
} from "@/lib/sst/epi";

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
  catalogoEpi,
  custos,
  fardamento,
  resumoFichas,
  caExtra,
}: {
  aba: AbaEpi;
  colaboradores: ColaboradorEpi[];
  matriz: (FuncaoEpi & { fixos: number })[];
  /** Nomes de todos os EPIs do catálogo — sugestão ao adicionar EPI extra numa função. */
  catalogoEpi: string[];
  custos: { trimestres: CustoTrimestre[]; linhas: LinhaCustoEpi[] };
  fardamento: LinhaCustoFardamento[];
  resumoFichas: { enviadas: number; assinadas: number };
  /** CA que o RH já informou pra EPIs extras (o catálogo estático tem CA fixo pros seus itens). */
  caExtra: Record<string, string>;
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
        <ColaboradoresTab
          colaboradores={colaboradores}
          precos={custos.linhas}
          busca={busca}
          onBusca={setBusca}
          resumoFichas={resumoFichas}
          itensFardamento={fardamento.map((f) => f.tipo)}
        />
      )}
      {aba === "matriz" && <MatrizTab matriz={matriz} catalogoEpi={catalogoEpi} caExtra={caExtra} />}
      {aba === "custos" && <CustosTab custos={custos} fardamento={fardamento} />}
    </div>
  );
}

/** Vencidos (vermelho), vencendo em até 30 dias (laranja) e em dia (verde), sobre os EPIs obrigatórios. */
function SituacaoEpiChips({ situacao }: { situacao: SituacaoEpi }) {
  const chips = [
    { rotulo: "Vencidos", n: situacao.vencidos, cor: "border-status-danger-border bg-status-danger-bg text-status-danger" },
    { rotulo: "Vencendo", n: situacao.vencendo, cor: "border-orange-200 bg-orange-50 text-orange-700" },
    { rotulo: "Ativo", n: situacao.emDia, cor: "border-status-success-border bg-status-success-bg text-status-success" },
  ].filter((c) => c.n > 0);
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {chips.map((c) => (
        <span key={c.rotulo} className={`whitespace-nowrap rounded-full border px-1.5 py-px text-[10px] font-semibold ${c.cor}`}>
          {c.rotulo} {c.n}/{situacao.total}
        </span>
      ))}
    </div>
  );
}

function ColaboradoresTab({
  colaboradores,
  precos,
  busca,
  onBusca,
  resumoFichas,
  itensFardamento,
}: {
  colaboradores: ColaboradorEpi[];
  precos: { epi: string; ca: string; valorUnitario: number }[];
  busca: string;
  onBusca: (v: string) => void;
  resumoFichas: { enviadas: number; assinadas: number };
  itensFardamento: string[];
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
              <th className="px-2 py-1 text-right">
                {resumoFichas.enviadas > 0 && (
                  <span
                    title={`De ${resumoFichas.enviadas} ficha(s) enviada(s), ${resumoFichas.assinadas} assinada(s)`}
                    className={
                      "rounded-full px-1.5 py-px text-[10px] font-bold tracking-normal normal-case " +
                      (resumoFichas.assinadas < resumoFichas.enviadas
                        ? "bg-status-warning-bg text-status-warning"
                        : "bg-status-success-bg text-status-success")
                    }
                  >
                    {resumoFichas.assinadas}/{resumoFichas.enviadas}
                  </span>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-foreground-muted">
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
                  <td className="px-2 py-1">
                    <SituacaoEpiChips situacao={c.situacaoEpi} />
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
      <FichaEpiDrawer colaborador={fichaAberta} catalogo={precos.map((p) => ({ epi: p.epi, ca: p.ca }))}
        itensFardamento={itensFardamento} onFechar={() => setFichaAberta(null)} />
    </Card>
  );
}

function MatrizTab({
  matriz,
  catalogoEpi,
  caExtra,
}: {
  matriz: (FuncaoEpi & { fixos: number })[];
  catalogoEpi: string[];
  caExtra: Record<string, string>;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<(FuncaoEpi & { fixos: number }) | null>(null);

  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {matriz.map((f) => (
        <Card key={f.funcao} className="relative px-3 py-2.5">
          <button
            type="button"
            onClick={() => setEditando(f)}
            title="Adicionar EPI a esta função"
            aria-label={`Adicionar EPI a ${f.funcao}`}
            className="absolute top-2 right-2 rounded p-1 text-foreground-muted/50 hover:bg-brand-surface hover:text-foreground"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-2.5 w-2.5" aria-hidden>
              <path d="M14.85 2.15a1.5 1.5 0 0 1 2.12 0l.88.88a1.5 1.5 0 0 1 0 2.12l-1.1 1.1-3-3 1.1-1.1Zm-2.16 2.16 3 3L6.94 16.06a1 1 0 0 1-.46.26l-3.1.83.83-3.1a1 1 0 0 1 .26-.46L12.7 4.3Z" />
            </svg>
          </button>
          <div className="flex items-center gap-2 pr-6">
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

      {editando && (
        <EditarMatrizModal
          funcaoEpi={editando}
          catalogoEpi={catalogoEpi}
          caExtra={caExtra}
          onFechar={() => setEditando(null)}
          onMudou={() => router.refresh()}
        />
      )}
    </div>
  );
}

function EditarMatrizModal({
  funcaoEpi,
  catalogoEpi,
  caExtra,
  onFechar,
  onMudou,
}: {
  funcaoEpi: FuncaoEpi & { fixos: number };
  catalogoEpi: string[];
  caExtra: Record<string, string>;
  onFechar: () => void;
  /** Chamado depois de cada adição/remoção já persistida, pra atualizar a lista por trás (sem fechar o modal). */
  onMudou: () => void;
}) {
  const fixos = funcaoEpi.epis.slice(0, funcaoEpi.fixos);
  const [extras, setExtras] = useState<string[]>(funcaoEpi.epis.slice(funcaoEpi.fixos));
  const [novoEpi, setNovoEpi] = useState("");
  const [novoCa, setNovoCa] = useState("");
  const [casLocais, setCasLocais] = useState<Record<string, string>>(caExtra);
  const [casEmEdicao, setCasEmEdicao] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvarCa(equip: string, ca: string) {
    try {
      await fetch("/api/sst/epi/ca", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equip, ca }),
      });
      setCasLocais((c) => ({ ...c, [equip]: ca }));
    } catch {
      // CA é só um dado auxiliar do cadastro — se falhar, o EPI extra continua
      // adicionado normalmente, a RH tenta preencher o CA de novo depois.
    }
  }

  /** Persiste a lista de extras na hora — sem depender de um botão "Salvar" separado no rodapé. */
  async function persistirExtras(novaLista: string[]): Promise<boolean> {
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/sst/epi/matriz", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funcao: funcaoEpi.funcao, epis: novaLista }),
      });
      if (!r.ok) throw new Error((await r.json()).erro ?? "Falha ao salvar.");
      onMudou();
      return true;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function adicionar() {
    const nome = novoEpi.trim();
    if (!nome || fixos.includes(nome) || extras.includes(nome)) {
      setNovoEpi("");
      setNovoCa("");
      return;
    }
    const novaLista = [...extras, nome];
    setExtras(novaLista);
    setNovoEpi("");
    setNovoCa("");
    const ok = await persistirExtras(novaLista);
    if (!ok) {
      setExtras((e) => e.filter((x) => x !== nome));
      return;
    }
    const ca = novoCa.trim();
    if (ca) void salvarCa(nome, ca);
  }

  async function remover(epi: string) {
    const novaLista = extras.filter((x) => x !== epi);
    setExtras(novaLista);
    const ok = await persistirExtras(novaLista);
    if (!ok) setExtras((e) => [...e, epi]);
  }

  const sugestoes = catalogoEpi.filter((e) => !fixos.includes(e) && !extras.includes(e));

  return (
    <Modal
      aberto
      onFechar={onFechar}
      eyebrow="Matriz de EPI"
      titulo={`EPIs de ${funcaoEpi.funcao}`}
      largura="26rem"
      rodape={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover"
          >
            Fechar
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-2.5">
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">Fixos da matriz</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {fixos.map((epi) => (
              <span
                key={epi}
                className="rounded-full border border-hairline bg-surface-page px-2 py-0.5 text-[10.5px] text-foreground-muted"
              >
                {epi}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">EPIs extras</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {extras.length === 0 && <p className="text-[11px] text-foreground-muted">Nenhum EPI extra ainda.</p>}
            {extras.map((epi) => (
              <span
                key={epi}
                className="flex items-center gap-1 rounded-full border border-brand-primary/40 bg-brand-primary-050 px-2 py-0.5 text-[10.5px] text-brand-primary-800"
              >
                {epi}
                {casLocais[epi] && <span className="text-brand-primary-800/70">· CA {casLocais[epi]}</span>}
                <button
                  type="button"
                  onClick={() => void remover(epi)}
                  aria-label={`Remover ${epi}`}
                  className="text-brand-primary-800 hover:text-status-danger"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          {extras.some((epi) => !casLocais[epi]) && (
            <div className="mt-1.5 flex flex-col gap-1">
              {extras
                .filter((epi) => !casLocais[epi])
                .map((epi) => (
                  <div key={epi} className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-[11px] text-foreground-muted">Sem CA: {epi}</span>
                    <input
                      value={casEmEdicao[epi] ?? ""}
                      onChange={(e) => setCasEmEdicao((c) => ({ ...c, [epi]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && casEmEdicao[epi]?.trim()) {
                          e.preventDefault();
                          void salvarCa(epi, casEmEdicao[epi].trim());
                        }
                      }}
                      placeholder="CA"
                      className="w-20 shrink-0 rounded border border-hairline bg-background px-1.5 py-1 text-[11px] text-foreground outline-none focus:border-brand-primary"
                    />
                    <button
                      type="button"
                      disabled={!casEmEdicao[epi]?.trim()}
                      onClick={() => void salvarCa(epi, casEmEdicao[epi].trim())}
                      className="shrink-0 rounded border border-hairline px-2 py-1 text-[10.5px] font-medium text-brand-primary-800 hover:bg-brand-primary-050 disabled:opacity-40"
                    >
                      Salvar
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <input
            value={novoEpi}
            onChange={(e) => setNovoEpi(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void adicionar();
              }
            }}
            list="catalogo-epi-sugestoes"
            placeholder="Nome do EPI"
            className="min-w-0 flex-1 rounded border border-hairline bg-background px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-brand-primary"
          />
          <input
            value={novoCa}
            onChange={(e) => setNovoCa(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void adicionar();
              }
            }}
            placeholder="CA (se tiver)"
            className="w-28 shrink-0 rounded border border-hairline bg-background px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-brand-primary"
          />
          <datalist id="catalogo-epi-sugestoes">
            {sugestoes.map((epi) => (
              <option key={epi} value={epi} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={() => void adicionar()}
            disabled={salvando}
            className="shrink-0 rounded border border-hairline px-2.5 py-1.5 text-[11.5px] font-medium text-brand-primary-800 hover:bg-brand-primary-050 disabled:opacity-50"
          >
            Adicionar
          </button>
        </div>
        {erro && <p className="text-[11.5px] text-status-danger">{erro}</p>}
      </div>
    </Modal>
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
