"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Card } from "@/components/shared/Card";
import { Badge } from "@/components/shared/Badge";
import { Modal } from "@/components/shared/Modal";
import { Drawer } from "@/components/shared/Drawer";
import { CabecalhoFiltravel, CampoTexto, COR_VINCULO } from "@/components/modules/colaboradores/ColaboradoresTable";
import { formatarMoeda } from "@/lib/format";
import type { Vinculo } from "@/lib/db/colaboradores";
import type { ColaboradorExame, FuncaoExames, FuncaoRiscos, LinhaCustoExame, RiscoOcupacional, TipoRisco } from "@/lib/sst/exames";

// Duplicado do rótulo de lib/sst/exames.ts (server-only) — cliente não pode
// importar valor de lá, só tipo.
const ROTULO_TIPO_RISCO: Record<TipoRisco, string> = {
  fisico: "Físico",
  quimico: "Químico",
  biologico: "Biológico",
  ergonomico: "Ergonômico",
};

export type AbaExames = "colaboradores" | "matriz" | "ocupacional" | "custos";

const ABAS: { id: AbaExames; label: string }[] = [
  { id: "colaboradores", label: "Colaboradores" },
  { id: "matriz", label: "Matriz por Função" },
  { id: "ocupacional", label: "Matriz Ocupacional" },
  { id: "custos", label: "Custo e Valores" },
];

const COR_RISCO: Record<TipoRisco, string> = {
  fisico: "border-status-warning-border bg-status-warning-bg text-status-warning",
  quimico: "border-status-danger-border bg-status-danger-bg text-status-danger",
  biologico: "border-status-success-border bg-status-success-bg text-status-success",
  ergonomico: "border-brand-primary/40 bg-brand-primary-050 text-brand-primary-800",
};

export function ExamesPageClient({
  aba,
  colaboradores,
  matrizExames,
  matrizRiscos,
  catalogoExames,
  custos,
}: {
  aba: AbaExames;
  colaboradores: ColaboradorExame[];
  matrizExames: FuncaoExames[];
  matrizRiscos: FuncaoRiscos[];
  /** Nomes dos exames do catálogo — sugestão ao adicionar exame numa função. */
  catalogoExames: string[];
  custos: LinhaCustoExame[];
}) {
  const router = useRouter();
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
              if (aba !== "colaboradores") router.push("/sst/exames?aba=colaboradores");
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
            href={`/sst/exames?aba=${a.id}`}
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

      {aba === "colaboradores" && <ColaboradoresTab colaboradores={colaboradores} busca={busca} onBusca={setBusca} />}
      {aba === "matriz" && <MatrizExamesTab matriz={matrizExames} catalogoExames={catalogoExames} />}
      {aba === "ocupacional" && <MatrizOcupacionalTab matriz={matrizRiscos} />}
      {aba === "custos" && <CustosTab custos={custos} />}
    </div>
  );
}

function ColaboradoresTab({
  colaboradores,
  busca,
  onBusca,
}: {
  colaboradores: ColaboradorExame[];
  busca: string;
  onBusca: (v: string) => void;
}) {
  const [colaboradorAberto, setColaboradorAberto] = useState<ColaboradorExame | null>(null);
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
              <th className="px-2 py-1" />
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
                  <td className="px-2 py-1 text-right">
                    {c.examesObrigatorios.length > 0 && (
                      <span className="whitespace-nowrap rounded-full border border-status-warning-border bg-status-warning-bg px-1.5 py-px text-[10px] font-semibold text-status-warning">
                        Pendente {c.examesObrigatorios.length}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => setColaboradorAberto(c)}
                      aria-label={`Exames de ${c.nome}`}
                      title="Exames do colaborador"
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

      {colaboradorAberto && (
        <Drawer aberto onFechar={() => setColaboradorAberto(null)} titulo="Exames do colaborador" subtitulo={colaboradorAberto.nome} largura="26rem">
          <div className="flex flex-col gap-3 p-4">
            <p className="text-[10.5px] text-foreground-muted">
              Matriz Ocupacional: {colaboradorAberto.funcaoMatriz ?? "função não encontrada"}
            </p>
            {colaboradorAberto.funcaoMatriz === null ? (
              <div className="rounded-md border border-hairline bg-surface-page px-3 py-2.5 text-[12px] text-foreground-muted">
                O cargo deste colaborador não tem função correspondente na Matriz por Função.
              </div>
            ) : colaboradorAberto.examesObrigatorios.length === 0 ? (
              <div className="rounded-md border border-hairline bg-surface-page px-3 py-2.5 text-[12px] text-foreground-muted">
                Esta função ainda não tem exames cadastrados na Matriz por Função.
              </div>
            ) : (
              <div>
                <p className="text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">Exames obrigatórios</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {colaboradorAberto.examesObrigatorios.map((exame) => (
                    <span
                      key={exame}
                      className="rounded-full border border-hairline bg-surface-page px-2 py-0.5 text-[10.5px] text-foreground"
                    >
                      {exame}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[10.5px] text-foreground-muted">
              O registro de exame realizado (ficha, data, vencimento) ainda não existe neste módulo — por enquanto
              esta lista mostra só o que a função exige.
            </p>
          </div>
        </Drawer>
      )}
    </Card>
  );
}

function MatrizExamesTab({ matriz, catalogoExames }: { matriz: FuncaoExames[]; catalogoExames: string[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<FuncaoExames | null>(null);

  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {matriz.map((f) => (
        <Card key={f.funcao} className="relative px-3 py-2.5">
          <button
            type="button"
            onClick={() => setEditando(f)}
            title="Adicionar exame a esta função"
            aria-label={`Adicionar exame a ${f.funcao}`}
            className="absolute top-2 right-2 rounded p-1 text-foreground-muted/50 hover:bg-brand-surface hover:text-foreground"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-2.5 w-2.5" aria-hidden>
              <path d="M14.85 2.15a1.5 1.5 0 0 1 2.12 0l.88.88a1.5 1.5 0 0 1 0 2.12l-1.1 1.1-3-3 1.1-1.1Zm-2.16 2.16 3 3L6.94 16.06a1 1 0 0 1-.46.26l-3.1.83.83-3.1a1 1 0 0 1 .26-.46L12.7 4.3Z" />
            </svg>
          </button>
          <div className="flex items-center gap-2 pr-6">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-primary-100 text-brand-primary-800">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                <path d="M9 2a1 1 0 0 0-1 1v1H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V3a1 1 0 1 0-2 0v1H9V3a1 1 0 0 0-1-1Zm-1 8h6v1.5H8V10Zm0 3h6v1.5H8V13Z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-semibold text-foreground">{f.funcao}</p>
              <p className="text-[10.5px] text-foreground-muted">{f.exames.length} exame(s)</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {f.exames.length === 0 ? (
              <p className="text-[10.5px] text-foreground-muted">Nenhum exame cadastrado ainda.</p>
            ) : (
              f.exames.map((exame) => (
                <span
                  key={exame}
                  className="flex items-center gap-1 rounded-full border border-hairline bg-surface-page px-2 py-0.5 text-[10.5px] text-foreground"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
                  {exame}
                </span>
              ))
            )}
          </div>
        </Card>
      ))}

      {editando && (
        <EditarExamesModal
          funcaoExames={editando}
          catalogoExames={catalogoExames}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function EditarExamesModal({
  funcaoExames,
  catalogoExames,
  onFechar,
  onSalvo,
}: {
  funcaoExames: FuncaoExames;
  catalogoExames: string[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [exames, setExames] = useState<string[]>(funcaoExames.exames);
  const [novoExame, setNovoExame] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function adicionar() {
    const nome = novoExame.trim();
    if (!nome || exames.includes(nome)) {
      setNovoExame("");
      return;
    }
    setExames((e) => [...e, nome]);
    setNovoExame("");
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/sst/exames/matriz", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funcao: funcaoExames.funcao, exames }),
      });
      if (!r.ok) throw new Error((await r.json()).erro ?? "Falha ao salvar.");
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  const sugestoes = catalogoExames.filter((e) => !exames.includes(e));

  return (
    <Modal
      aberto
      onFechar={onFechar}
      eyebrow="Matriz por Função"
      titulo={`Exames de ${funcaoExames.funcao}`}
      largura="26rem"
      rodape={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="rounded border border-hairline px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-surface-page"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando}
            className="rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-2.5">
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">Exames desta função</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {exames.length === 0 && <p className="text-[11px] text-foreground-muted">Nenhum exame ainda.</p>}
            {exames.map((exame) => (
              <span
                key={exame}
                className="flex items-center gap-1 rounded-full border border-brand-primary/40 bg-brand-primary-050 px-2 py-0.5 text-[10.5px] text-brand-primary-800"
              >
                {exame}
                <button
                  type="button"
                  onClick={() => setExames((e) => e.filter((x) => x !== exame))}
                  aria-label={`Remover ${exame}`}
                  className="text-brand-primary-800 hover:text-status-danger"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            value={novoExame}
            onChange={(e) => setNovoExame(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionar();
              }
            }}
            list="catalogo-exames-sugestoes"
            placeholder="Nome do exame"
            className="min-w-0 flex-1 rounded border border-hairline bg-background px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-brand-primary"
          />
          <datalist id="catalogo-exames-sugestoes">
            {sugestoes.map((exame) => (
              <option key={exame} value={exame} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={adicionar}
            className="shrink-0 rounded border border-hairline px-2.5 py-1.5 text-[11.5px] font-medium text-brand-primary-800 hover:bg-brand-primary-050"
          >
            Adicionar
          </button>
        </div>
        {erro && <p className="text-[11.5px] text-status-danger">{erro}</p>}
      </div>
    </Modal>
  );
}

function MatrizOcupacionalTab({ matriz }: { matriz: FuncaoRiscos[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<FuncaoRiscos | null>(null);

  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {matriz.map((f) => (
        <Card key={f.funcao} className="relative px-3 py-2.5">
          <button
            type="button"
            onClick={() => setEditando(f)}
            title="Adicionar risco a esta função"
            aria-label={`Adicionar risco a ${f.funcao}`}
            className="absolute top-2 right-2 rounded p-1 text-foreground-muted/50 hover:bg-brand-surface hover:text-foreground"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-2.5 w-2.5" aria-hidden>
              <path d="M14.85 2.15a1.5 1.5 0 0 1 2.12 0l.88.88a1.5 1.5 0 0 1 0 2.12l-1.1 1.1-3-3 1.1-1.1Zm-2.16 2.16 3 3L6.94 16.06a1 1 0 0 1-.46.26l-3.1.83.83-3.1a1 1 0 0 1 .26-.46L12.7 4.3Z" />
            </svg>
          </button>
          <div className="flex items-center gap-2 pr-6">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-status-warning-bg text-status-warning">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                <path d="M10.9 2.5a1 1 0 0 0-1.8 0l-8 15A1 1 0 0 0 2 19h16a1 1 0 0 0 .9-1.5l-8-15ZM10 8a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Zm0 7a1.1 1.1 0 1 1 0 2.2A1.1 1.1 0 0 1 10 15Z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-semibold text-foreground">{f.funcao}</p>
              <p className="text-[10.5px] text-foreground-muted">{f.riscos.length} risco(s)</p>
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {f.riscos.length === 0 ? (
              <p className="text-[10.5px] text-foreground-muted">Nenhum risco cadastrado ainda.</p>
            ) : (
              f.riscos.map((r, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span
                    className={`shrink-0 rounded-full border px-1.5 py-px text-[9.5px] font-semibold whitespace-nowrap ${COR_RISCO[r.tipo]}`}
                  >
                    {ROTULO_TIPO_RISCO[r.tipo]}
                  </span>
                  <span className="text-[10.5px] text-foreground">{r.descricao}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      ))}

      {editando && (
        <EditarRiscosModal
          funcaoRiscos={editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function EditarRiscosModal({
  funcaoRiscos,
  onFechar,
  onSalvo,
}: {
  funcaoRiscos: FuncaoRiscos;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [riscos, setRiscos] = useState<RiscoOcupacional[]>(funcaoRiscos.riscos);
  const [tipo, setTipo] = useState<TipoRisco>("fisico");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function adicionar() {
    const texto = descricao.trim();
    if (!texto) return;
    setRiscos((r) => [...r, { tipo, descricao: texto }]);
    setDescricao("");
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/sst/exames/riscos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funcao: funcaoRiscos.funcao, riscos }),
      });
      if (!r.ok) throw new Error((await r.json()).erro ?? "Falha ao salvar.");
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      eyebrow="Matriz Ocupacional"
      titulo={`Riscos de ${funcaoRiscos.funcao}`}
      largura="28rem"
      rodape={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="rounded border border-hairline px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-surface-page"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando}
            className="rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-2.5">
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">Riscos desta função</p>
          {riscos.length === 0 ? (
            <p className="mt-1 text-[11px] text-foreground-muted">Nenhum risco ainda.</p>
          ) : (
            <div className="mt-1 flex flex-col gap-1.5">
              {riscos.map((r, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded border border-hairline bg-surface-page px-2 py-1">
                  <span className={`shrink-0 rounded-full border px-1.5 py-px text-[9.5px] font-semibold whitespace-nowrap ${COR_RISCO[r.tipo]}`}>
                    {ROTULO_TIPO_RISCO[r.tipo]}
                  </span>
                  <span className="min-w-0 flex-1 text-[11.5px] text-foreground">{r.descricao}</span>
                  <button
                    type="button"
                    onClick={() => setRiscos((rs) => rs.filter((_, idx) => idx !== i))}
                    aria-label={`Remover risco ${r.descricao}`}
                    className="shrink-0 text-foreground-muted hover:text-status-danger"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoRisco)}
            className="shrink-0 rounded border border-hairline bg-background px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-brand-primary"
          >
            {Object.entries(ROTULO_TIPO_RISCO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionar();
              }
            }}
            placeholder="Descrição do risco (ex.: ruído acima do limite de tolerância)"
            className="min-w-0 flex-1 rounded border border-hairline bg-background px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-brand-primary"
          />
          <button
            type="button"
            onClick={adicionar}
            className="shrink-0 rounded border border-hairline px-2.5 py-1.5 text-[11.5px] font-medium text-brand-primary-800 hover:bg-brand-primary-050"
          >
            Adicionar
          </button>
        </div>
        {erro && <p className="text-[11.5px] text-status-danger">{erro}</p>}
      </div>
    </Modal>
  );
}

function CustosTab({ custos }: { custos: LinhaCustoExame[] }) {
  const totalGeral = custos.reduce((acc, l) => acc + l.valorTotal, 0);

  return (
    <div className="space-y-4">
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-hairline bg-background text-left font-bold tracking-wide text-foreground-muted uppercase">
              <th className="px-3 py-2 text-[10.5px]">Código</th>
              <th className="px-3 py-2 text-[10.5px]">Exame</th>
              <th className="px-3 py-2 text-right text-[10.5px]">Cargos</th>
              <th className="px-3 py-2 text-right text-[10.5px]">Valor unitário</th>
              <th className="px-3 py-2 text-right text-[10.5px]">Valor estimado</th>
            </tr>
          </thead>
          <tbody>
            {custos.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-foreground-muted">
                  Nenhum exame cadastrado no catálogo de preços ainda.
                </td>
              </tr>
            ) : (
              custos.map((l) => (
                <tr key={l.codigo} className="border-t border-hairline/60">
                  <td className="px-3 py-1.5 text-foreground-muted">{l.codigo}</td>
                  <td className="px-3 py-1.5 font-semibold text-foreground">{l.nome}</td>
                  <td className="px-3 py-1.5 text-right text-foreground">{l.cargos}</td>
                  <td className="px-3 py-1.5 text-right text-foreground-muted">{formatarMoeda(l.valorUnitario)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-brand-primary-800">{formatarMoeda(l.valorTotal)}</td>
                </tr>
              ))
            )}
          </tbody>
          {custos.length > 0 && (
            <tfoot>
              <tr className="border-t border-hairline bg-background font-semibold">
                <td className="px-3 py-2 text-foreground" colSpan={4}>
                  Total estimado
                </td>
                <td className="px-3 py-2 text-right text-brand-primary-800">{formatarMoeda(totalGeral)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
      <p className="text-[10.5px] text-foreground-muted">
        Valor estimado = valor do exame × quantos cargos precisam dele na Matriz Ocupacional original (não é o
        realizado — ainda não existe registro de exame feito neste módulo).
      </p>
    </div>
  );
}
