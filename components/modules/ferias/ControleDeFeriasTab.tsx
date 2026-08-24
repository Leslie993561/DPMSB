"use client";

import { useEffect, useMemo, useState } from "react";
import type { PeriodoAquisitivoAberto, PeriodoEmCurso, SituacaoPeriodo } from "@/lib/db/periodosAquisitivos";
import type { Colaborador } from "@/lib/db/colaboradores";
import { formatarDataBr } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Badge, type CorBadge } from "@/components/shared/Badge";
import { Card } from "@/components/shared/Card";
import { FilterChip } from "@/components/shared/FilterChip";
import { PeriodoDetalheModal, type AlvoHistorico } from "./PeriodoDetalheModal";

const ROTULO_SITUACAO: Record<SituacaoPeriodo, { label: string; cor: CorBadge }> = {
  vencida: { label: "Vencido", cor: "vermelho" },
  a_vencer: { label: "Em aberto", cor: "amarelo" },
  programada: { label: "Programada", cor: "azul" },
};

/**
 * A tabela mistura duas coisas: períodos aquisitivos com saldo e colaboradores
 * sem nada pendente. São tipos diferentes de propósito — quem está em dia não
 * tem período para exibir, e inventar datas para preencher as colunas seria
 * pior do que deixá-las vazias.
 */
type LinhaControle =
  | { chave: string; nome: string; tipo: "periodo"; periodo: PeriodoAquisitivoAberto }
  | { chave: string; nome: string; tipo: "emDia"; emCurso: PeriodoEmCurso };

type FiltroStatus = "todos" | "vencidas" | "a_vencer";
type CategoriaExportar = "colaborador" | "setor" | "trimestre";

const ANO_ATUAL = new Date().getFullYear();
const ANOS_EXPORTAR = [ANO_ATUAL, ANO_ATUAL + 1, ANO_ATUAL + 2];
const FAIXA_TRIMESTRE: Record<1 | 2 | 3 | 4, string> = {
  1: "jan-mar",
  2: "abr-jun",
  3: "jul-set",
  4: "out-dez",
};

/** Os botões de importar e exportar ficam no cabeçalho da página, daí o estado vir de fora. */
export function ControleDeFeriasTab({
  importarAberto,
  onFecharImportar,
  exportarAberto: exportarArquivoAberto,
  onFecharExportar,
}: {
  importarAberto: boolean;
  onFecharImportar: () => void;
  exportarAberto: boolean;
  onFecharExportar: () => void;
}) {
  /** "individual" precisa saber de quem; "situacao" exporta a tabela inteira. */
  const [modoArquivo, setModoArquivo] = useState<"individual" | "situacao">("situacao");
  const [colaboradorArquivo, setColaboradorArquivo] = useState("");
  const [periodos, setPeriodos] = useState<PeriodoAquisitivoAberto[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [emCurso, setEmCurso] = useState<PeriodoEmCurso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const [alvoHistorico, setAlvoHistorico] = useState<AlvoHistorico | null>(null);

  const [exportarAberto, setExportarAberto] = useState(false);
  const [categoriaExportar, setCategoriaExportar] = useState<CategoriaExportar | null>(null);
  const [colaboradorExportar, setColaboradorExportar] = useState("");
  const [setorExportar, setSetorExportar] = useState("");
  const [trimestreExportar, setTrimestreExportar] = useState<1 | 2 | 3 | 4>(1);
  const [anoExportar, setAnoExportar] = useState(ANO_ATUAL);

  async function recarregar() {
    try {
      const [pRes, cRes] = await Promise.all([fetch("/api/periodos-aquisitivos"), fetch("/api/colaboradores")]);
      const [pData, cData] = await Promise.all([pRes.json(), cRes.json()]);
      setPeriodos(pData.periodos ?? []);
      setEmCurso(pData.emCurso ?? []);
      setColaboradores(cData.colaboradores ?? []);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void recarregar();
  }, []);

  function fecharExportar() {
    setExportarAberto(false);
    setCategoriaExportar(null);
  }

  function alvoExportarPronto(): boolean {
    if (categoriaExportar === "colaborador") return Boolean(colaboradorExportar);
    if (categoriaExportar === "setor") return Boolean(setorExportar);
    if (categoriaExportar === "trimestre") return true;
    return false;
  }

  function urlExportar(): string {
    if (categoriaExportar === "colaborador") {
      return `/api/periodos-aquisitivos/exportar?tipo=colaborador&colaboradorId=${colaboradorExportar}`;
    }
    if (categoriaExportar === "setor") {
      return `/api/periodos-aquisitivos/exportar?tipo=setor&setor=${encodeURIComponent(setorExportar)}`;
    }
    return `/api/periodos-aquisitivos/exportar?tipo=trimestre&trimestre=${trimestreExportar}&ano=${anoExportar}`;
  }

  const [arquivoImportar, setArquivoImportar] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [erroImportar, setErroImportar] = useState<string | null>(null);
  const [resultadoImportar, setResultadoImportar] = useState<{
    atualizados: number;
    criados: number;
    descartados: { linha: number; motivo: string }[];
  } | null>(null);

  function fecharImportar() {
    onFecharImportar();
    setArquivoImportar(null);
    setErroImportar(null);
    setResultadoImportar(null);
  }

  async function lerArquivo() {
    if (!arquivoImportar) return;
    setImportando(true);
    setErroImportar(null);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivoImportar);
      const res = await fetch("/api/periodos-aquisitivos/importar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setErroImportar(data.erro ?? "Erro ao ler o arquivo.");
        return;
      }
      setResultadoImportar(data);
      void recarregar();
    } catch {
      setErroImportar("Falha de comunicação com o servidor.");
    } finally {
      setImportando(false);
    }
  }

  /**
   * Setores do CADASTRO, não só dos períodos em aberto — senão um setor cujo
   * pessoal está todo em dia desaparece do filtro, e parece que ele não existe.
   */
  const departamentos = useMemo(
    () =>
      Array.from(
        new Set(
          colaboradores
            .filter((c) => c.status !== "desligado")
            .map((c) => c.departamento)
            .filter((d): d is string => Boolean(d)),
        ),
      ).sort(),
    [colaboradores],
  );

  const vencidas = useMemo(() => periodos.filter((p) => p.vencida), [periodos]);
  const aVencer90 = useMemo(
    () => periodos.filter((p) => !p.vencida && p.diasParaVencer >= 0 && p.diasParaVencer <= 90),
    [periodos],
  );
  const aVencer30 = aVencer90.filter((p) => p.diasParaVencer <= 30).length;
  const aVencer60 = aVencer90.filter((p) => p.diasParaVencer > 30 && p.diasParaVencer <= 60).length;
  const aVencer90Only = aVencer90.filter((p) => p.diasParaVencer > 60).length;

  /**
   * A tabela lista TODOS os colaboradores ativos, não só os que têm período em
   * aberto — assim o Controle serve para consultar qualquer pessoa, e um setor
   * inteiro em dia não desaparece da tela. Quem não tem saldo entra como linha
   * "Em dia", com as colunas de período vazias em vez de datas inventadas; o ⋮
   * abre o histórico completo dessa pessoa do mesmo jeito.
   */
  const linhas = useMemo((): LinhaControle[] => {
    const comPeriodo = periodos.map(
      (p): LinhaControle => ({ chave: `p${p.id}`, nome: p.colaboradorNome, tipo: "periodo", periodo: p }),
    );
    const emDia = emCurso.map(
      (e): LinhaControle => ({ chave: `c${e.colaboradorId}`, nome: e.colaboradorNome, tipo: "emDia", emCurso: e }),
    );
    return [...comPeriodo, ...emDia];
  }, [periodos, emCurso]);

  const filtrados = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      const nome = l.nome;
      const cpf = l.tipo === "periodo" ? l.periodo.colaboradorCpf : l.emCurso.colaboradorCpf;
      const depto = l.tipo === "periodo" ? l.periodo.colaboradorDepartamento : l.emCurso.colaboradorDepartamento;

      const bateBusca =
        !buscaNorm || nome.toLowerCase().includes(buscaNorm) || (cpf ?? "").toLowerCase().includes(buscaNorm);
      const bateDepartamento = !departamento || depto === departamento;
      // "Vencidas" e "A vencer" falam de saldo — quem está em dia só aparece em "Todos".
      const bateStatus =
        filtroStatus === "todos"
          ? true
          : l.tipo === "periodo" &&
            (filtroStatus === "vencidas"
              ? l.periodo.vencida
              : !l.periodo.vencida && l.periodo.situacao === "a_vencer");
      return bateBusca && bateDepartamento && bateStatus;
    });
  }, [linhas, busca, departamento, filtroStatus]);

  /** Lista única, sem separação por setor — cargo/setor aparecem como legenda abaixo do nome. */
  const ordenados = useMemo(
    () => [...filtrados].sort((a, b) => a.nome.localeCompare(b.nome)),
    [filtrados],
  );

  if (carregando) return <p className="text-sm text-foreground-muted">Carregando...</p>;

  return (
    <div className="space-y-5">

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Card className="border-status-danger-border bg-status-danger-bg px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1 text-[9px] font-bold tracking-[0.08em] text-status-danger-icon uppercase">
              <span aria-hidden>▲</span> Férias vencidas
            </p>
            <span className="text-base font-semibold text-status-danger">{vencidas.length}</span>
          </div>
          <p className="mt-0.5 text-[10px] text-status-danger-icon">limite p/ gozo já expirado · pagamento em dobra</p>
          {vencidas.length > 0 && (
            <button
              type="button"
              onClick={() => setFiltroStatus("vencidas")}
              className="mt-1 truncate text-left text-[10.5px] font-semibold text-status-danger hover:underline"
            >
              {vencidas
                .slice(0, 2)
                .map((p) => p.colaboradorNome)
                .join(" · ")}{" "}
              ›
            </button>
          )}
        </Card>

        <Card className="border-status-warning-border bg-status-warning-bg px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1 text-[9px] font-bold tracking-[0.08em] text-status-warning-icon uppercase">
              <span aria-hidden>◔</span> Próximas do vencimento
            </p>
            <span className="text-base font-semibold text-status-warning">{aVencer90.length}</span>
          </div>
          <div className="mt-1 flex gap-1">
            {[
              ["30d", aVencer30],
              ["60d", aVencer60],
              ["90d", aVencer90Only],
            ].map(([label, n]) => (
              <span
                key={label}
                className="rounded-full border border-status-warning-border bg-background px-1.5 py-0.5 text-[9.5px] font-bold text-status-warning"
              >
                {n} em {label}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3">
          <h2 className="text-sm font-medium text-foreground">
            Empregados <span className="ml-1 rounded-full bg-brand-surface px-1.5 py-0.5 text-[10.5px] font-bold text-foreground-muted">{filtrados.length}</span>
          </h2>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip ativo={filtroStatus === "todos"} onClick={() => setFiltroStatus("todos")}>
              Todos
            </FilterChip>
            <FilterChip ativo={filtroStatus === "vencidas"} onClick={() => setFiltroStatus("vencidas")}>
              Vencidas
            </FilterChip>
            <FilterChip ativo={filtroStatus === "a_vencer"} onClick={() => setFiltroStatus("a_vencer")}>
              A vencer
            </FilterChip>
          </div>
          <select
            value={departamento}
            onChange={(e) => setDepartamento(e.target.value)}
            className="rounded-md border border-brand-surface bg-background px-2.5 py-1.5 text-xs text-foreground dark:border-brand-neutral/30"
          >
            <option value="">Todos os setores</option>
            {departamentos.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empregado…"
            className="w-52 rounded-md border border-brand-surface bg-background px-2.5 py-1.5 text-xs text-foreground dark:border-brand-neutral/30"
          />
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setExportarAberto((v) => !v)}
              className="flex items-center gap-1 rounded-md border border-brand-surface px-3 py-1.5 text-xs font-semibold text-foreground-muted transition-colors hover:border-brand-primary hover:text-brand-primary-800 dark:border-brand-neutral/30"
            >
              <span aria-hidden>↓</span> Exportar <span aria-hidden className="text-[9px]">▾</span>
            </button>
            {exportarAberto && (
              <>
                <div className="fixed inset-0 z-20" onClick={fecharExportar} />
                <div className="absolute top-full right-0 z-30 mt-1.5 w-[300px] rounded-md border border-hairline bg-background p-3 shadow-drawer">
                  <p className="mb-2 text-[10px] font-semibold tracking-wide text-brand-primary-800 uppercase">
                    O que deseja exportar
                  </p>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setCategoriaExportar("colaborador")}
                      className={cn(
                        "rounded px-2 py-1.5 text-left text-[11.5px] transition-colors hover:bg-surface-page",
                        categoriaExportar === "colaborador" && "bg-brand-primary-050",
                      )}
                    >
                      <span className="block font-medium text-foreground">Por colaborador</span>
                      <span className="block text-[10px] text-foreground-muted">
                        Todo o histórico: cada período, dias de direito/gozados/restantes, limite e situação
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoriaExportar("setor")}
                      className={cn(
                        "rounded px-2 py-1.5 text-left text-[11.5px] transition-colors hover:bg-surface-page",
                        categoriaExportar === "setor" && "bg-brand-primary-050",
                      )}
                    >
                      <span className="block font-medium text-foreground">Por setor</span>
                      <span className="block text-[10px] text-foreground-muted">
                        Informações principais de todos do setor: admissão, aquisitivo, concessivo, situação
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoriaExportar("trimestre")}
                      className={cn(
                        "rounded px-2 py-1.5 text-left text-[11.5px] transition-colors hover:bg-surface-page",
                        categoriaExportar === "trimestre" && "bg-brand-primary-050",
                      )}
                    >
                      <span className="block font-medium text-foreground">Por trimestre</span>
                      <span className="block text-[10px] text-foreground-muted">
                        Vencimentos agrupados por Q1 jan-mar · Q2 abr-jun · Q3 jul-set · Q4 out-dez
                      </span>
                    </button>
                  </div>

                  {categoriaExportar === "colaborador" && (
                    <select
                      value={colaboradorExportar}
                      onChange={(e) => setColaboradorExportar(e.target.value)}
                      className="mt-2 w-full rounded border border-hairline bg-background px-2 py-1.5 text-[11.5px] text-foreground dark:border-brand-neutral/30"
                    >
                      <option value="">Selecione um empregado</option>
                      {colaboradores.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  )}
                  {categoriaExportar === "setor" && (
                    <select
                      value={setorExportar}
                      onChange={(e) => setSetorExportar(e.target.value)}
                      className="mt-2 w-full rounded border border-hairline bg-background px-2 py-1.5 text-[11.5px] text-foreground dark:border-brand-neutral/30"
                    >
                      <option value="">Selecione um setor</option>
                      {departamentos.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  )}
                  {categoriaExportar === "trimestre" && (
                    <div className="mt-2 flex gap-1.5">
                      <select
                        value={trimestreExportar}
                        onChange={(e) => setTrimestreExportar(Number(e.target.value) as 1 | 2 | 3 | 4)}
                        className="flex-1 rounded border border-hairline bg-background px-2 py-1.5 text-[11.5px] text-foreground dark:border-brand-neutral/30"
                      >
                        {([1, 2, 3, 4] as const).map((q) => (
                          <option key={q} value={q}>
                            Q{q} · {FAIXA_TRIMESTRE[q]}
                          </option>
                        ))}
                      </select>
                      <select
                        value={anoExportar}
                        onChange={(e) => setAnoExportar(Number(e.target.value))}
                        className="rounded border border-hairline bg-background px-2 py-1.5 text-[11.5px] text-foreground dark:border-brand-neutral/30"
                      >
                        {ANOS_EXPORTAR.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {categoriaExportar && (
                    <a
                      href={alvoExportarPronto() ? urlExportar() : undefined}
                      onClick={(e) => {
                        if (!alvoExportarPronto()) e.preventDefault();
                        else fecharExportar();
                      }}
                      download
                      aria-disabled={!alvoExportarPronto()}
                      className={cn(
                        "mt-2 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium text-brand-white transition-colors",
                        alvoExportarPronto() ? "bg-brand-primary hover:bg-brand-primary-hover" : "cursor-not-allowed bg-foreground-muted/40",
                      )}
                    >
                      ↓ Baixar Excel
                    </a>
                  )}
                  {!categoriaExportar && (
                    <p className="mt-2 text-[10.5px] text-foreground-muted">
                      Selecione um empregado, setor ou trimestre para exportar.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {filtrados.length === 0 ? (
          <p className="p-8 text-center text-sm text-foreground-muted">Nenhum colaborador para os filtros atuais.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-[11.5px]">
              <thead>
                <tr className="border-b border-hairline bg-surface-page text-left text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">
                  <th className="w-10 px-3 py-2">Cód</th>
                  <th className="px-3 py-2">Colaborador</th>
                  <th className="px-3 py-2">Admissão</th>
                  <th className="px-3 py-2">Aquisitivo</th>
                  <th className="px-3 py-2">Concessivo</th>
                  <th className="px-3 py-2 text-right">Dir</th>
                  <th className="px-3 py-2 text-right">Goz</th>
                  <th className="px-3 py-2 text-right">Rest</th>
                  <th className="px-3 py-2">Limite p/ gozo</th>
                  <th className="px-3 py-2">Situação</th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map((l) =>
                  l.tipo === "periodo" ? (
                    <LinhaPeriodo
                      key={l.chave}
                      periodo={l.periodo}
                      onAbrir={(p, acao) =>
                        setAlvoHistorico({
                          colaboradorId: p.colaboradorId,
                          colaboradorNome: p.colaboradorNome,
                          colaboradorDepartamento: p.colaboradorDepartamento,
                          periodo: p,
                          acaoInicial: acao,
                        })
                      }
                    />
                  ) : (
                    <LinhaEmDia
                      key={l.chave}
                      emCurso={l.emCurso}
                      onAbrir={(e) =>
                        setAlvoHistorico({
                          colaboradorId: e.colaboradorId,
                          colaboradorNome: e.colaboradorNome,
                          colaboradorDepartamento: e.colaboradorDepartamento,
                          periodo: null,
                        })
                      }
                    />
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-hairline bg-surface-page px-4 py-2.5 text-xs text-foreground-muted">
          Leitura fiel ao relatório do DP: <strong>DIR</strong> = dias de direito, <strong>GOZ</strong> = dias já gozados,{" "}
          <strong>REST</strong> = dias restantes. Vencido = limite p/ gozo anterior a hoje com dias restantes.
        </div>
      </Card>

      {alvoHistorico && (
        <PeriodoDetalheModal
          alvo={alvoHistorico}
          onFechar={() => setAlvoHistorico(null)}
          onAtualizado={() => {
            setAlvoHistorico(null);
            void recarregar();
          }}
        />
      )}

      {exportarArquivoAberto && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-md border border-hairline bg-background shadow-drawer">
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold tracking-wide text-brand-primary-800 uppercase">Férias</p>
                <h3 className="text-[13.5px] font-semibold text-foreground">Exportar arquivo</h3>
              </div>
              <button type="button" onClick={onFecharExportar} className="text-foreground-muted hover:text-foreground">
                ✕
              </button>
            </div>

            <div className="space-y-3 p-4">
              <button
                type="button"
                onClick={() => setModoArquivo("individual")}
                className={cn(
                  "w-full rounded-md border px-3 py-2.5 text-left transition-colors",
                  modoArquivo === "individual"
                    ? "border-brand-primary bg-brand-primary-050"
                    : "border-hairline hover:bg-surface-page",
                )}
              >
                <span className="block text-[12.5px] font-semibold text-foreground">Relatório completo individual</span>
                <span className="block text-[11px] text-foreground-muted">
                  Planilha com todos os períodos de férias que a pessoa já gozou — datas e dias — mais a situação atual
                  dela.
                </span>
              </button>

              {modoArquivo === "individual" && (
                <select
                  value={colaboradorArquivo}
                  onChange={(ev) => setColaboradorArquivo(ev.target.value)}
                  className="w-full rounded-md border border-hairline bg-background px-2.5 py-2 text-[12.5px] text-foreground dark:border-brand-neutral/30"
                >
                  <option value="">Selecione o colaborador…</option>
                  {colaboradores
                    .filter((c) => c.status !== "desligado")
                    .slice()
                    .sort((a, z) => a.nome.localeCompare(z.nome, "pt-BR"))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => setModoArquivo("situacao")}
                className={cn(
                  "w-full rounded-md border px-3 py-2.5 text-left transition-colors",
                  modoArquivo === "situacao"
                    ? "border-brand-primary bg-brand-primary-050"
                    : "border-hairline hover:bg-surface-page",
                )}
              >
                <span className="block text-[12.5px] font-semibold text-foreground">Somente a situação atual</span>
                <span className="block text-[11px] text-foreground-muted">
                  Em Excel, as mesmas linhas desta aba: aquisitivo, concessivo, dir/goz/rest, limite p/ gozo e situação.
                </span>
              </button>
            </div>

            <div className="flex justify-end gap-2 border-t border-hairline px-4 py-3">
              <button
                type="button"
                onClick={onFecharExportar}
                className="rounded-md border border-hairline px-4 py-2 text-[12.5px] text-foreground-muted hover:bg-surface-page"
              >
                Fechar
              </button>
              <a
                href={
                  modoArquivo === "individual"
                    ? `/api/periodos-aquisitivos/exportar?tipo=individual&colaboradorId=${colaboradorArquivo}`
                    : "/api/periodos-aquisitivos/exportar?tipo=situacao"
                }
                onClick={(ev) => {
                  if (modoArquivo === "individual" && !colaboradorArquivo) ev.preventDefault();
                  else onFecharExportar();
                }}
                aria-disabled={modoArquivo === "individual" && !colaboradorArquivo}
                className={cn(
                  "rounded-md bg-brand-primary px-4 py-2 text-[12.5px] font-medium text-brand-white transition-colors hover:bg-brand-primary-hover",
                  modoArquivo === "individual" && !colaboradorArquivo && "pointer-events-none opacity-50",
                )}
              >
                ↓ Baixar planilha
              </a>
            </div>
          </div>
        </div>
      )}

      {importarAberto && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-md border border-hairline bg-background shadow-drawer">
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
              <h3 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
                <span aria-hidden>📎</span> Anexar arquivo do DP
              </h3>
              <button type="button" onClick={fecharImportar} className="text-foreground-muted hover:text-foreground">
                ✕
              </button>
            </div>

            <div className="space-y-3 p-4">
              <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border-2 border-dashed border-hairline px-4 py-6 text-center hover:border-brand-primary">
                <span aria-hidden className="text-xl text-brand-primary">
                  ⬆
                </span>
                <span className="text-[12px] font-medium text-foreground">
                  {arquivoImportar ? arquivoImportar.name : "Clique para anexar"}
                </span>
                <span className="text-[10.5px] text-foreground-muted">
                  Programação de Férias em PDF ou planilha XLS/XLSX · até 10 MB
                </span>
                <input
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    setResultadoImportar(null);
                    setErroImportar(null);
                    setArquivoImportar(e.target.files?.[0] ?? null);
                  }}
                />
              </label>

              <div>
                <p className="mb-1 text-[10px] font-semibold tracking-wide text-brand-primary-800 uppercase">
                  Campos lidos do arquivo
                </p>
                <p className="text-[10.5px] leading-relaxed text-foreground-muted">
                  Código (opcional) · Empregado · Início e fim do período aquisitivo · Dias de direito e gozados ·
                  Abono
                </p>
              </div>

              {erroImportar && (
                <p className="rounded border border-status-danger-border bg-status-danger-bg px-2 py-1.5 text-[11px] text-status-danger">
                  {erroImportar}
                </p>
              )}

              {resultadoImportar && (
                <div className="rounded border border-status-success-bg bg-status-success-bg px-2 py-1.5 text-[11px] text-status-success">
                  {resultadoImportar.criados} período(s) criado(s) · {resultadoImportar.atualizados} atualizado(s)
                  {resultadoImportar.descartados.length > 0 && (
                    <>
                      <br />
                      {resultadoImportar.descartados.length} linha(s) descartada(s):
                      <ul className="mt-1 list-inside list-disc">
                        {resultadoImportar.descartados.slice(0, 5).map((d, i) => (
                          <li key={i}>
                            Linha {d.linha}: {d.motivo}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <a
                  href="/api/periodos-aquisitivos/modelo"
                  download
                  className="text-[11px] font-medium text-brand-primary hover:text-brand-primary-hover"
                >
                  ↓ Baixar modelo
                </a>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={fecharImportar}
                    className="rounded border border-hairline px-3 py-1.5 text-[12px] font-medium text-foreground-muted hover:bg-surface-page dark:border-brand-neutral/30"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={lerArquivo}
                    disabled={!arquivoImportar || importando}
                    className="flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
                  >
                    {importando ? "Lendo..." : "✓ Ler arquivo"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Menu suspenso do ⋮ na lateral do nome. Abre o histórico de férias e, quando
 * há programação em aberto, oferece o cancelamento direto — o cancelamento em
 * si acontece no modal, que é onde se escolhe QUAL lançamento cancelar quando
 * existe mais de um.
 */
function MenuLinha({
  temProgramacao,
  onHistorico,
  onCancelar,
}: {
  temProgramacao: boolean;
  onHistorico: () => void;
  onCancelar: () => void;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="Ações do colaborador"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="rounded px-1 leading-none text-foreground-muted hover:bg-brand-surface hover:text-foreground"
      >
        <span aria-hidden>⋮</span>
      </button>

      {aberto && (
        <>
          {/* Camada de fechamento: qualquer clique fora recolhe o menu. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setAberto(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <span className="absolute top-full left-0 z-40 mt-1 flex w-52 flex-col overflow-hidden rounded-md border border-hairline bg-background py-1 shadow-drawer">
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                onHistorico();
              }}
              className="px-3 py-1.5 text-left text-[12px] font-normal text-foreground normal-case hover:bg-surface-page"
            >
              Ver histórico de férias
            </button>
            <button
              type="button"
              disabled={!temProgramacao}
              onClick={() => {
                setAberto(false);
                onCancelar();
              }}
              title={temProgramacao ? undefined : "Nenhum lançamento programado para cancelar"}
              className="px-3 py-1.5 text-left text-[12px] font-normal normal-case text-red-600 hover:bg-surface-page disabled:cursor-not-allowed disabled:text-foreground-muted/50 disabled:hover:bg-transparent dark:text-red-400"
            >
              Cancelar lançamento
            </button>
          </span>
        </>
      )}
    </span>
  );
}

function LinhaPeriodo({
  periodo: p,
  onAbrir,
}: {
  periodo: PeriodoAquisitivoAberto;
  onAbrir: (p: PeriodoAquisitivoAberto, acao?: "cancelar") => void;
}) {
  return (
    <tr className={cn("border-b border-hairline/60 last:border-0 hover:bg-surface-page/60", p.alerta && "bg-status-danger-bg/40")}>
      <td className="px-3 py-2 text-[10px] text-foreground-muted/70">#{p.colaboradorId}</td>
      <td className="px-3 py-2">
        <span className="flex items-center gap-1.5">
          <MenuLinha
            temProgramacao={p.situacao === "programada"}
            onHistorico={() => onAbrir(p)}
            onCancelar={() => onAbrir(p, "cancelar")}
          />
          <button type="button" onClick={() => onAbrir(p)} className="text-left hover:text-brand-primary-800">
            <span className="block font-medium text-foreground uppercase">{p.colaboradorNome}</span>
            <span className="block text-[10px] font-normal text-foreground-muted normal-case">
              {p.colaboradorCargo ?? "—"} · {p.colaboradorDepartamento ?? "—"}
            </span>
          </button>
        </span>
      </td>
      <td className="px-3 py-2 text-foreground-muted">{formatarDataBr(p.colaboradorAdmissao)}</td>
      <td className="px-3 py-2 text-foreground-muted">
        {formatarDataBr(p.dataInicio)} – {formatarDataBr(p.dataFim)}
      </td>
      <td className="px-3 py-2 text-foreground-muted">
        {formatarDataBr(p.concessivoInicio)} – {formatarDataBr(p.concessivoFim)}
      </td>
      <td className="px-3 py-2 text-right text-foreground-muted">{p.diasDireito}</td>
      <td className={cn("px-3 py-2 text-right font-semibold", p.diasTirados > 0 ? "text-status-success" : "text-foreground-muted/60 font-normal")}>
        {p.diasTirados}
      </td>
      <td className="px-3 py-2 text-right font-semibold text-foreground">{p.diasATirar}</td>
      {/* Mesma coluna do relatório do DP: última data para INICIAR o gozo do
          saldo, que recua conforme os dias restantes — não o fim do concessivo. */}
      <td
        className={cn("px-3 py-2 text-foreground-muted", p.vencida && "font-bold text-status-danger")}
        title={`Concessivo até ${formatarDataBr(p.concessivoFim)} — ${p.diasATirar} dia(s) a gozar`}
      >
        {formatarDataBr(p.limiteGozo)}
      </td>
      <td className="px-3 py-2">
        <Badge cor={ROTULO_SITUACAO[p.situacao].cor}>{ROTULO_SITUACAO[p.situacao].label}</Badge>
      </td>
    </tr>
  );
}

/**
 * Colaborador sem saldo exigível. Mostra o período aquisitivo EM CURSO — o que
 * ainda não fechou — com concessivo e limite p/ gozo já projetados, para a
 * linha não ficar só de traços. DIR/GOZ/REST são do período em curso; o número
 * pequeno abaixo de DIR é quanto ele já acumulou (1/12 por mês trabalhado).
 */
function LinhaEmDia({
  emCurso: e,
  onAbrir,
}: {
  emCurso: PeriodoEmCurso;
  onAbrir: (e: PeriodoEmCurso) => void;
}) {
  const j = e.janela;

  return (
    <tr className="border-b border-hairline/60 last:border-0 hover:bg-surface-page/60">
      <td className="px-3 py-2 text-[10px] text-foreground-muted/70">#{e.colaboradorId}</td>
      <td className="px-3 py-2">
        <span className="flex items-center gap-1.5">
          <MenuLinha temProgramacao={false} onHistorico={() => onAbrir(e)} onCancelar={() => onAbrir(e)} />
          <button type="button" onClick={() => onAbrir(e)} className="text-left hover:text-brand-primary-800">
            <span className="block font-medium text-foreground uppercase">{e.colaboradorNome}</span>
            <span className="block text-[10px] font-normal text-foreground-muted normal-case">
              {e.colaboradorCargo ?? "—"} · {e.colaboradorDepartamento ?? "—"}
            </span>
          </button>
        </span>
      </td>
      <td className="px-3 py-2 text-foreground-muted">{formatarDataBr(e.colaboradorAdmissao)}</td>
      {j ? (
        <>
          <td className="px-3 py-2 text-foreground-muted">
            {formatarDataBr(j.aquisitivoInicio)} – {formatarDataBr(j.aquisitivoFim)}
            {j.derivado && (
              <span
                className="ml-1 text-[9px] text-status-warning"
                title="Período calculado pela data de admissão: este colaborador ainda não apareceu em nenhum relatório do DP."
              >
                estimado
              </span>
            )}
          </td>
          <td className="px-3 py-2 text-foreground-muted">
            {formatarDataBr(j.concessivoInicio)} – {formatarDataBr(j.concessivoFim)}
          </td>
          <td className="px-3 py-2 text-right text-foreground-muted">
            {j.diasDireito}
            <span className="block text-[9px] text-foreground-muted/70" title="Dias já acumulados: 1/12 por mês completo">
              {j.diasAcumulados} acum.
            </span>
          </td>
          <td
            className={cn(
              "px-3 py-2 text-right font-semibold",
              j.diasTirados > 0 ? "text-status-success" : "font-normal text-foreground-muted/60",
            )}
          >
            {j.diasTirados}
          </td>
          <td className="px-3 py-2 text-right font-semibold text-foreground">{j.diasATirar}</td>
          <td className="px-3 py-2 text-foreground-muted">{formatarDataBr(j.limiteGozo)}</td>
        </>
      ) : (
        /* Sem período do DP e fora da lista de projeção: colunas vazias em vez de datas sem respaldo. */
        <>
          <td className="px-3 py-2 text-foreground-muted/50">—</td>
          <td className="px-3 py-2 text-foreground-muted/50">—</td>
          <td className="px-3 py-2 text-right text-foreground-muted/50">—</td>
          <td className="px-3 py-2 text-right text-foreground-muted/50">—</td>
          <td className="px-3 py-2 text-right text-foreground-muted/50">—</td>
          <td className="px-3 py-2 text-foreground-muted/50">—</td>
        </>
      )}
      <td className="px-3 py-2">
        <Badge cor="verde">Em dia</Badge>
      </td>
    </tr>
  );
}
