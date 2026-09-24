"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Card } from "@/components/shared/Card";
import { Badge } from "@/components/shared/Badge";
import { Modal } from "@/components/shared/Modal";
import { Drawer } from "@/components/shared/Drawer";
import { CabecalhoFiltravel, CampoTexto, COR_VINCULO } from "@/components/modules/colaboradores/ColaboradoresTable";
import { formatarMoeda, iniciais } from "@/lib/format";
import type { Vinculo } from "@/lib/db/colaboradores";
import type { CargoOcupacional, ColaboradorExame, FuncaoExames, LinhaCustoExame, SetorOcupacional } from "@/lib/sst/exames";

const TIPOS_ASO = [
  { valor: "admissional", label: "Admissional" },
  { valor: "periodico", label: "Periódico" },
  { valor: "retorno", label: "Retorno ao Trabalho" },
  { valor: "demissional", label: "Demissional" },
];
const LABEL_TIPO_ASO = new Map(TIPOS_ASO.map((t) => [t.valor, t.label]));

interface FichaExameResumo {
  id: string;
  tipoAso: string;
  dataRealizacao: string;
  exames: string[];
  anexoUrl: string | null;
  anexoNome: string | null;
}

export type AbaExames = "colaboradores" | "matriz" | "ocupacional" | "custos";

const ABAS: { id: AbaExames; label: string }[] = [
  { id: "colaboradores", label: "Colaboradores" },
  { id: "matriz", label: "Matriz por Função" },
  { id: "ocupacional", label: "Matriz Ocupacional" },
  { id: "custos", label: "Custo e Valores" },
];

/** Cor por grupo de risco — os nomes vêm crus da planilha (domain.ts não tem enum pra isto). */
function corRisco(tipo: string): string {
  const t = tipo.toUpperCase();
  if (t.includes("QUÍMIC")) return "border-status-danger-border bg-status-danger-bg text-status-danger";
  if (t.includes("BIOLÓGIC")) return "border-status-success-border bg-status-success-bg text-status-success";
  if (t.includes("ERGON")) return "border-brand-primary/40 bg-brand-primary-050 text-brand-primary-800";
  if (t.includes("FÍSIC")) return "border-status-warning-border bg-status-warning-bg text-status-warning";
  return "border-hairline bg-surface-page text-foreground-muted";
}

export function ExamesPageClient({
  aba,
  colaboradores,
  matrizExames,
  setoresOcupacionais,
  catalogoExames,
  custos,
}: {
  aba: AbaExames;
  colaboradores: ColaboradorExame[];
  matrizExames: FuncaoExames[];
  setoresOcupacionais: SetorOcupacional[];
  /** Nomes + periodicidade dos exames do catálogo. */
  catalogoExames: { nome: string; periodicidade: string }[];
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
      {aba === "matriz" && <MatrizExamesTab matriz={matrizExames} catalogoExames={catalogoExames.map((c) => c.nome)} />}
      {aba === "ocupacional" && <MatrizOcupacionalTab setores={setoresOcupacionais} catalogoExames={catalogoExames} />}
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
                    {c.examesVencidos > 0 && (
                      <span className="whitespace-nowrap rounded-full border border-status-danger-border bg-status-danger-bg px-1.5 py-px text-[10px] font-semibold text-status-danger">
                        Vencido {c.examesVencidos}/{c.examesObrigatorios.length}
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

      {colaboradorAberto && <ExameColaboradorDrawer colaborador={colaboradorAberto} onFechar={() => setColaboradorAberto(null)} />}
    </Card>
  );
}

function ExameColaboradorDrawer({ colaborador, onFechar }: { colaborador: ColaboradorExame; onFechar: () => void }) {
  const router = useRouter();
  const [fichas, setFichas] = useState<FichaExameResumo[] | null>(null);
  const [vencidos, setVencidos] = useState<string[]>([]);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [anexando, setAnexando] = useState(false);
  const [documento, setDocumento] = useState<{ ficha: FichaExameResumo } | null>(null);

  const carregar = useCallback(() => {
    const qs = new URLSearchParams({ colaboradorId: String(colaborador.id) });
    colaborador.examesObrigatorios.forEach((e) => qs.append("exame", e));
    fetch(`/api/sst/exames/fichas?${qs}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.erro ?? "Falha ao carregar o histórico.");
        setFichas(d.fichas);
        setVencidos(d.vencidos ?? []);
      })
      .catch((e: Error) => setErroCarga(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaborador.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function excluir(f: FichaExameResumo) {
    if (!window.confirm(`Excluir o registro de ${f.dataRealizacao}?`)) return;
    const r = await fetch(`/api/sst/exames/fichas/${f.id}`, { method: "DELETE" });
    if (!r.ok) {
      window.alert((await r.json()).erro ?? "Não foi possível excluir.");
      return;
    }
    carregar();
    router.refresh();
  }

  return (
    <>
      <Drawer aberto onFechar={onFechar} titulo="Ficha de exame ocupacional" subtitulo={colaborador.nome} largura="30rem">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-primary text-[15px] font-bold text-brand-white">
              {iniciais(colaborador.nome)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-foreground">{colaborador.nome}</p>
              <p className="text-[12px] text-foreground-muted">
                {colaborador.cargo ?? "—"} · {colaborador.departamento ?? "—"}
              </p>
              <p className="text-[10.5px] text-foreground-muted/80">
                Matriz Ocupacional: {colaborador.funcaoMatriz ?? "função não encontrada"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAnexando(true)}
            className="rounded-md bg-brand-primary px-3 py-2 text-[12.5px] font-semibold text-brand-white transition-colors hover:bg-brand-primary-hover"
          >
            Anexar exame ocupacional
          </button>

          {colaborador.funcaoMatriz === null ? (
            <div className="rounded-md border border-hairline bg-surface-page px-3 py-2.5 text-[12px] text-foreground-muted">
              O cargo deste colaborador não tem função correspondente na Matriz por Função.
            </div>
          ) : fichas !== null && vencidos.length > 0 ? (
            <div className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2.5 text-status-danger">
              <p className="text-[12.5px] font-semibold">⚠ {vencidos.length} exame(s) vencido(s)</p>
              <ul className="mt-1.5 list-inside list-disc text-[12px]">
                {vencidos.map((exame) => (
                  <li key={exame}>{exame}</li>
                ))}
              </ul>
            </div>
          ) : fichas !== null && colaborador.examesObrigatorios.length > 0 ? (
            <div className="rounded-md border border-status-success-border bg-status-success-bg px-3 py-2.5 text-[12px] text-status-success">
              Todos os exames obrigatórios da função estão em dia.
            </div>
          ) : null}

          <div>
            <p className="text-[13px] font-semibold text-foreground">Histórico de registros ({fichas?.length ?? 0})</p>
            {erroCarga ? (
              <p className="mt-3 text-[12px] text-status-danger">{erroCarga}</p>
            ) : fichas === null ? (
              <p className="mt-3 text-[12px] text-foreground-muted">Carregando...</p>
            ) : fichas.length === 0 ? (
              <p className="mt-3 text-[12px] text-foreground-muted">Nenhum registro de exame ainda.</p>
            ) : (
              <div className="mt-2 flex flex-col divide-y divide-hairline/70 rounded-md border border-hairline">
                {fichas.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="text-[12.5px] font-medium text-foreground">{f.dataRealizacao || "—"}</span>
                    <span className="flex-1 truncate text-center text-[10.5px] font-light whitespace-nowrap text-foreground-muted/80">
                      {LABEL_TIPO_ASO.get(f.tipoAso) ?? f.tipoAso}
                    </span>
                    {f.anexoUrl && (
                      <button
                        type="button"
                        onClick={() => setDocumento({ ficha: f })}
                        title="Ver documento anexado"
                        aria-label={`Ver documento de ${f.dataRealizacao}`}
                        className="rounded px-1.5 py-0.5 text-[15px] text-brand-primary hover:bg-brand-primary-100"
                      >
                        📎
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void excluir(f)}
                      title="Excluir registro"
                      aria-label={`Excluir registro de ${f.dataRealizacao}`}
                      className="rounded px-1.5 py-0.5 text-[13px] text-foreground-muted hover:bg-status-danger-bg hover:text-status-danger"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Drawer>

      {anexando && (
        <AnexarExameModal
          colaborador={colaborador}
          vencidos={vencidos}
          onFechar={() => setAnexando(false)}
          onCriado={() => {
            setAnexando(false);
            carregar();
            router.refresh();
          }}
        />
      )}

      {documento?.ficha.anexoUrl && (
        <Modal
          aberto
          onFechar={() => setDocumento(null)}
          eyebrow="Documento anexado"
          titulo={LABEL_TIPO_ASO.get(documento.ficha.tipoAso) ?? documento.ficha.tipoAso}
          subtitulo={colaborador.nome}
          largura="40rem"
        >
          <iframe
            src={`/api/sst/exames/fichas/${documento.ficha.id}/anexo`}
            title="Documento anexado"
            className="h-[70vh] w-full rounded-md border border-hairline"
          />
        </Modal>
      )}
    </>
  );
}

function AnexarExameModal({
  colaborador,
  vencidos,
  onFechar,
  onCriado,
}: {
  colaborador: ColaboradorExame;
  vencidos: string[];
  onFechar: () => void;
  onCriado: () => void;
}) {
  const [tipoAso, setTipoAso] = useState("periodico");
  const [dataRealizacao, setDataRealizacao] = useState(() => new Date().toISOString().slice(0, 10));
  const [marcados, setMarcados] = useState<Set<string>>(new Set(vencidos));
  const [anexo, setAnexo] = useState<{ url: string; nome: string } | null>(null);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternar(exame: string) {
    setMarcados((s) => {
      const novo = new Set(s);
      if (novo.has(exame)) novo.delete(exame);
      else novo.add(exame);
      return novo;
    });
  }

  async function anexarPdf(arquivo: File) {
    setErro(null);
    if (arquivo.type !== "application/pdf") {
      setErro("Só é permitido anexar PDF.");
      return;
    }
    setEnviandoAnexo(true);
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      const r = await fetch("/api/sst/exames/anexo", { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "Falha ao anexar o PDF.");
      setAnexo({ url: d.url, nome: d.nome });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao anexar o PDF.");
    } finally {
      setEnviandoAnexo(false);
    }
  }

  async function salvar() {
    if (marcados.size === 0) {
      setErro("Selecione ao menos um exame.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/sst/exames/fichas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colaboradorId: colaborador.id,
          tipoAso,
          exames: [...marcados].map((exame) => ({ exame, dataRealizacao })),
          anexoUrl: anexo?.url ?? null,
          anexoNome: anexo?.nome ?? null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "Falha ao registrar o exame.");
      onCriado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao registrar o exame.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      eyebrow="Exames Ocupacionais"
      titulo="Anexar exame ocupacional"
      subtitulo={colaborador.nome}
      largura="34rem"
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
            disabled={enviando || enviandoAnexo}
            className="rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {enviando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">Colaborador</p>
          <p className="text-[12.5px] text-foreground">
            {colaborador.nome} · {colaborador.funcaoMatriz ?? colaborador.cargo ?? "—"}
          </p>
        </div>

        <label className="block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
          Tipo de ASO
          <select
            value={tipoAso}
            onChange={(e) => setTipoAso(e.target.value)}
            className="mt-1 w-full rounded border border-hairline bg-background px-2.5 py-1.5 text-[12px] font-normal normal-case text-foreground outline-none focus:border-brand-primary"
          >
            {TIPOS_ASO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2 text-[11px]">
          <label className="cursor-pointer font-medium text-brand-primary hover:text-brand-primary-hover">
            {enviandoAnexo ? "Anexando..." : anexo ? "Trocar PDF anexado" : "📎 Anexar comprovante (opcional)"}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={enviandoAnexo}
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) void anexarPdf(arquivo);
                e.target.value = "";
              }}
            />
          </label>
          {anexo && (
            <span className="flex items-center gap-1 truncate text-foreground-muted">
              {anexo.nome}
              <button type="button" onClick={() => setAnexo(null)} aria-label="Remover anexo" className="text-foreground-muted hover:text-status-danger">
                ✕
              </button>
            </span>
          )}
        </div>

        <div>
          <p className="text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">Exames vencidos</p>
          {vencidos.length === 0 ? (
            <p className="mt-1 text-[11.5px] text-foreground-muted">
              Nenhum exame vencido pra esta função no momento — marque abaixo se quiser registrar mesmo assim.
            </p>
          ) : null}
          <div className="mt-1.5 flex flex-col divide-y divide-hairline/70 rounded-md border border-hairline">
            {(vencidos.length > 0 ? vencidos : colaborador.examesObrigatorios).map((exame) => (
              <label key={exame} className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-foreground">
                <input type="checkbox" checked={marcados.has(exame)} onChange={() => alternar(exame)} className="accent-brand-primary" />
                {exame}
              </label>
            ))}
          </div>
        </div>

        <label className="block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
          Data de realização
          <input
            type="date"
            value={dataRealizacao}
            onChange={(e) => setDataRealizacao(e.target.value)}
            className="mt-1 w-full rounded border border-hairline bg-background px-2.5 py-1.5 text-[12px] font-normal normal-case text-foreground outline-none focus:border-brand-primary"
          />
        </label>

        {erro && <p className="text-[11.5px] text-status-danger">{erro}</p>}
      </div>
    </Modal>
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

/**
 * Setor → cargo → detalhe (riscos, EPIs, exames com periodicidade). Dado real
 * da empresa, repassado pela Leslie — por enquanto só visualização (sem
 * lápis): é o que foi pedido, "separar em listas e clicar no cargo".
 */
function MatrizOcupacionalTab({
  setores,
  catalogoExames,
}: {
  setores: SetorOcupacional[];
  catalogoExames: { nome: string; periodicidade: string }[];
}) {
  const [setorAberto, setSetorAberto] = useState<string | null>(setores[0]?.setor ?? null);
  const [cargoAberto, setCargoAberto] = useState<CargoOcupacional | null>(null);
  const periodicidadePorExame = new Map(catalogoExames.map((c) => [c.nome, c.periodicidade]));

  return (
    <div className="grid gap-3 lg:grid-cols-[18rem_1fr]">
      <Card className="flex flex-col divide-y divide-hairline overflow-hidden p-0">
        {setores.map((s) => (
          <button
            key={s.setor}
            type="button"
            onClick={() => setSetorAberto(setorAberto === s.setor ? null : s.setor)}
            className={cn(
              "flex items-center justify-between px-3 py-2.5 text-left transition-colors",
              setorAberto === s.setor ? "bg-brand-primary-050" : "hover:bg-surface-page",
            )}
          >
            <span className="text-[12.5px] font-semibold text-foreground">{s.setor}</span>
            <span className="shrink-0 rounded-full bg-brand-primary-100 px-2 py-0.5 text-[10px] font-bold text-brand-primary-800">
              {s.cargos.length} cargo(s)
            </span>
          </button>
        ))}
      </Card>

      <Card className="overflow-hidden p-0">
        {!setorAberto ? (
          <p className="p-6 text-center text-[12px] text-foreground-muted">Selecione um setor à esquerda.</p>
        ) : (
          <div className="flex flex-col divide-y divide-hairline">
            {setores
              .find((s) => s.setor === setorAberto)
              ?.cargos.map((c) => (
                <button
                  key={c.cargo}
                  type="button"
                  onClick={() => setCargoAberto(c)}
                  className="flex items-center justify-between px-3 py-2 text-left hover:bg-surface-page"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-medium text-foreground">{c.cargo}</span>
                  </span>
                  <span aria-hidden className="shrink-0 text-foreground-muted">
                    ›
                  </span>
                </button>
              ))}
          </div>
        )}
      </Card>

      {cargoAberto && (
        <Modal
          aberto
          onFechar={() => setCargoAberto(null)}
          eyebrow={cargoAberto.setor}
          titulo={cargoAberto.cargo}
          subtitulo={`CBO ${cargoAberto.cbo || "—"}`}
          largura="32rem"
        >
          <div className="flex flex-col gap-4">
            {cargoAberto.semDadosCadastrados && (
              <div className="rounded-md border border-hairline bg-surface-page px-3 py-2.5 text-[12px] text-foreground-muted">
                Este cargo ainda não tem risco, EPI ou exame levantado na planilha de SST.
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">Riscos ocupacionais</p>
              {cargoAberto.riscos.length === 0 ? (
                <p className="mt-1 text-[12px] text-foreground-muted">Sem risco inventariado.</p>
              ) : (
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {cargoAberto.riscos.map((r, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className={`mt-0.5 shrink-0 rounded-full border px-1.5 py-px text-[9.5px] font-semibold whitespace-nowrap ${corRisco(r.tipo)}`}>
                        {r.tipo}
                      </span>
                      <span className="text-[12px] text-foreground">
                        {r.descricao} <span className="text-foreground-muted">· {r.frequencia}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">EPIs aplicáveis</p>
              {cargoAberto.epis.length === 0 ? (
                <p className="mt-1 text-[12px] text-foreground-muted">Não aplicável a este cargo.</p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {cargoAberto.epis.map((epi) => (
                    <span key={epi} className="rounded-full border border-hairline bg-surface-page px-2 py-0.5 text-[10.5px] text-foreground">
                      {epi}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">Exames obrigatórios</p>
              {cargoAberto.exames.length === 0 ? (
                <p className="mt-1 text-[12px] text-foreground-muted">Nenhum exame levantado para este cargo.</p>
              ) : (
                <div className="mt-1.5 overflow-hidden rounded-md border border-hairline">
                  <table className="w-full text-[11.5px]">
                    <thead>
                      <tr className="border-b border-hairline bg-surface-page text-left text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">
                        <th className="px-2.5 py-1.5">Exame</th>
                        <th className="px-2.5 py-1.5 text-right">Periodicidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cargoAberto.exames.map((exame) => (
                        <tr key={exame} className="border-t border-hairline/70">
                          <td className="px-2.5 py-1.5 text-foreground">{exame}</td>
                          <td className="px-2.5 py-1.5 text-right text-foreground-muted">{periodicidadePorExame.get(exame) || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CustosTab({ custos }: { custos: LinhaCustoExame[] }) {
  const totalEstimado = custos.reduce((acc, l) => acc + l.valorEstimado, 0);
  const totalRealizado = custos.reduce((acc, l) => acc + l.valorRealizado, 0);

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
              <th className="px-3 py-2 text-right text-[10.5px]">Valor realizado</th>
            </tr>
          </thead>
          <tbody>
            {custos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-foreground-muted">
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
                  <td className="px-3 py-1.5 text-right font-semibold text-brand-primary-800">{formatarMoeda(l.valorEstimado)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-status-success">{formatarMoeda(l.valorRealizado)}</td>
                </tr>
              ))
            )}
          </tbody>
          {custos.length > 0 && (
            <tfoot>
              <tr className="border-t border-hairline bg-background font-semibold">
                <td className="px-3 py-2 text-foreground" colSpan={4}>
                  Total
                </td>
                <td className="px-3 py-2 text-right text-brand-primary-800">{formatarMoeda(totalEstimado)}</td>
                <td className="px-3 py-2 text-right text-status-success">{formatarMoeda(totalRealizado)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
      <p className="text-[10.5px] text-foreground-muted">
        Valor estimado = previsão para aplicação no ano corrente (até 31/12) — valor do exame × quantos cargos
        precisam dele na Matriz Ocupacional. Valor realizado = o que já foi de fato gasto (exames com registro de
        realização) — ainda 0 em todo lugar até existir esse registro no módulo.
      </p>
    </div>
  );
}
