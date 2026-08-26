"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatarMoeda } from "@/lib/format";
import { Modal } from "@/components/shared/Modal";
import { RiskCallout } from "@/components/shared/RiskCallout";
import { cn } from "@/lib/cn";

interface ItemVariavel {
  categoria: "transporte" | "mobilidade" | "alimentacao" | "aniversario";
  valor: number;
  motivo: string | null;
  arquivo: string | null;
}

interface LinhaRateio {
  colaboradorId: number;
  nome: string;
  cpf: string | null;
  vinculo: string | null;
  departamento: string | null;
  cidade: string | null;
  tipoTransporte: string;
  valeTransporte: number;
  /** "cadastro" = veio do valor por dia do colaborador; o resto é suprimento. */
  origemVt: "cadastro" | "tarifa-cidade" | "sem-valor" | "vm-fixo";
  valeAlimentacao: number;
  variaveis: number;
  variaveisItens: ItemVariavel[];
}

const ROTULO_CATEGORIA_VARIAVEL: Record<ItemVariavel["categoria"], string> = {
  transporte: "Transporte",
  mobilidade: "Mobilidade",
  alimentacao: "Alimentação",
  aniversario: "Aniversário",
};

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_COMPLETOS = [
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

function competenciaAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function competenciaLonga(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return `${MESES_COMPLETOS[mes - 1]} de ${ano}`;
}

function rotuloVale(tipoTransporte: string): string {
  return tipoTransporte === "vm_fixo" ? "VM" : "VT";
}

export function RateioTab() {
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [linhas, setLinhas] = useState<LinhaRateio[]>([]);
  const [diasUteis, setDiasUteis] = useState(0);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [importarAberto, setImportarAberto] = useState(false);
  const [menuMes, setMenuMes] = useState<number | null>(null);
  const [avisosAbertos, setAvisosAbertos] = useState(false);
  const avisosRef = useRef<HTMLDivElement>(null);
  const [editandoMes, setEditandoMes] = useState<number | null>(null);
  const [valorEdicaoDiasUteis, setValorEdicaoDiasUteis] = useState("");
  const [salvandoDiasUteis, setSalvandoDiasUteis] = useState(false);
  const [menuVariavelAberto, setMenuVariavelAberto] = useState(false);
  const [importarVariaveisAberto, setImportarVariaveisAberto] = useState(false);
  const [colaboradorHover, setColaboradorHover] = useState<number | null>(null);

  async function recarregar() {
    try {
      const res = await fetch(`/api/beneficios/rateio?competencia=${competencia}`);
      const data = await res.json();
      setLinhas(data.linhas ?? []);
      setDiasUteis(data.diasUteis ?? 0);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencia]);

  const filtrados = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    return buscaNorm ? linhas.filter((l) => l.nome.toLowerCase().includes(buscaNorm)) : linhas;
  }, [linhas, busca]);

  // Quem tem VT calculado por tarifa da cidade em vez do valor cadastrado: para
  // essas pessoas, mexer no Quadro de Colaboradores não muda nada aqui, e sem
  // aviso não havia como descobrir isso olhando a tela.
  const semValorNoCadastro = useMemo(() => linhas.filter((l) => l.origemVt === "tarifa-cidade"), [linhas]);
  const semTarifaNenhuma = useMemo(() => linhas.filter((l) => l.origemVt === "sem-valor"), [linhas]);

  useEffect(() => {
    if (!avisosAbertos) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (!avisosRef.current?.contains(e.target as Node)) setAvisosAbertos(false);
    };
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [avisosAbertos]);

  const ano = competencia.slice(0, 4);

  async function abrirEdicaoDiasUteis(mesNum: number) {
    setMenuMes(null);
    setEditandoMes(mesNum);
    setValorEdicaoDiasUteis("");
    const res = await fetch(`/api/beneficios/dias-uteis?ano=${ano}`);
    const data = await res.json();
    const doMes = (data.meses ?? []).find((mm: { mes: number; diasUteis: number }) => mm.mes === mesNum);
    if (doMes) setValorEdicaoDiasUteis(String(doMes.diasUteis));
  }

  async function salvarDiasUteis(mesNum: number) {
    setSalvandoDiasUteis(true);
    try {
      await fetch("/api/beneficios/dias-uteis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ano: Number(ano), mes: mesNum, diasUteis: Number(valorEdicaoDiasUteis) }),
      });
      setEditandoMes(null);
      await recarregar();
    } finally {
      setSalvandoDiasUteis(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuVariavelAberto((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-hairline bg-background px-3 py-1.5 text-[12px] font-semibold text-foreground transition-colors hover:border-brand-primary hover:text-brand-primary-800 dark:border-brand-neutral/30"
          >
            <span aria-hidden>🧮</span> Variável
          </button>

          {menuVariavelAberto && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuVariavelAberto(false)} />
              <div className="absolute top-full right-0 z-30 mt-1.5 w-56 rounded-md border border-hairline bg-background py-1 shadow-drawer">
                <button
                  type="button"
                  onClick={() => {
                    setMenuVariavelAberto(false);
                    setImportarVariaveisAberto(true);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-[12px] text-foreground hover:bg-surface-page"
                >
                  Importar planilha
                </button>
                <a
                  href="/api/beneficios/variaveis/modelo"
                  download
                  onClick={() => setMenuVariavelAberto(false)}
                  className="block w-full px-3 py-1.5 text-left text-[12px] text-foreground hover:bg-surface-page"
                >
                  Baixar planilha modelo
                </a>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {MESES_ABREV.map((m, i) => {
            const mesNum = i + 1;
            const ativo = Number(competencia.slice(5, 7)) === mesNum;
            const menuAberto = menuMes === mesNum;
            const editandoEsteMs = editandoMes === mesNum;
            return (
              <div key={m} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuMes(menuAberto ? null : mesNum)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                    ativo
                      ? "border-brand-primary-100 bg-brand-primary-100 font-bold text-brand-primary-800"
                      : "border-hairline bg-background text-foreground-muted hover:border-brand-primary",
                  )}
                >
                  {m}
                </button>

                {menuAberto && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setMenuMes(null)} />
                    <div className="absolute top-full left-0 z-30 mt-1.5 w-44 rounded-md border border-hairline bg-background py-1 shadow-drawer">
                      <button
                        type="button"
                        onClick={() => {
                          setCompetencia(`${ano}-${String(mesNum).padStart(2, "0")}`);
                          setMenuMes(null);
                        }}
                        className="block w-full px-3 py-1.5 text-left text-[12px] text-foreground hover:bg-surface-page"
                      >
                        Rateio do mês
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirEdicaoDiasUteis(mesNum)}
                        className="block w-full px-3 py-1.5 text-left text-[12px] text-foreground hover:bg-surface-page"
                      >
                        Editar
                      </button>
                    </div>
                  </>
                )}

                {editandoEsteMs && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setEditandoMes(null)} />
                    <div className="absolute top-full left-0 z-30 mt-1.5 w-56 rounded-md border border-hairline bg-background p-3 shadow-drawer">
                      <p className="text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
                        Dias úteis · {m}/{ano}
                      </p>
                      <p className="mt-0.5 text-[10px] text-foreground-muted">
                        vale a partir deste mês, até o próximo ajuste
                      </p>
                      <input
                        type="number"
                        min={0}
                        max={31}
                        autoFocus
                        value={valorEdicaoDiasUteis}
                        onChange={(e) => setValorEdicaoDiasUteis(e.target.value)}
                        className="mt-2 w-full rounded-md border border-brand-primary bg-background px-2 py-1 text-sm text-foreground"
                      />
                      <div className="mt-2 flex gap-1.5">
                        <button
                          type="button"
                          disabled={salvandoDiasUteis}
                          onClick={() => salvarDiasUteis(mesNum)}
                          className="flex-1 rounded bg-brand-primary px-2 py-1.5 text-[11px] font-semibold text-brand-white hover:bg-brand-primary-700 disabled:opacity-50"
                        >
                          {salvandoDiasUteis ? "Salvando..." : "Salvar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditandoMes(null)}
                          className="rounded border border-hairline px-2 py-1.5 text-[11px] text-foreground-muted hover:bg-surface-page"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <label className="relative">
          <span aria-hidden className="absolute top-1/2 left-2.5 -translate-y-1/2 text-foreground-muted">
            🔍
          </span>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar colaborador..."
            className="w-56 rounded-md border border-hairline bg-background py-1.5 pl-8 pr-3 text-[12.5px] text-foreground dark:border-brand-neutral/30"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <a
          href={`/api/beneficios/rateio/exportar?competencia=${competencia}`}
          download
          className="flex items-center gap-1.5 rounded-md border border-hairline bg-background px-3 py-2 text-[12.5px] font-semibold text-foreground transition-colors hover:border-brand-primary hover:text-brand-primary-800 dark:border-brand-neutral/30"
        >
          <span aria-hidden>📄</span> Exportar rateio
        </a>
        <button
          type="button"
          onClick={() => setImportarAberto(true)}
          className="flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-2 text-[12.5px] font-semibold text-brand-white transition-colors hover:bg-brand-primary-700"
        >
          <span aria-hidden>⬆</span> Importar rateio
        </button>
      </div>

      {(semValorNoCadastro.length > 0 || semTarifaNenhuma.length > 0) && (
        <div ref={avisosRef} className="relative self-start">
          {/* Os dois avisos ocupavam um terço da tela toda vez que a aba abria.
              Ficam atrás de uma bolinha: o número continua à vista, o texto
              inteiro aparece a um clique. */}
          <button
            type="button"
            onClick={() => setAvisosAbertos((v) => !v)}
            aria-expanded={avisosAbertos}
            aria-label={`${semValorNoCadastro.length + semTarifaNenhuma.length} aviso(s) sobre vale-transporte`}
            className={cn(
              "flex items-center gap-2 rounded-full border py-1.5 pr-3 pl-2 text-[12px] font-semibold transition-colors",
              semTarifaNenhuma.length > 0
                ? "border-status-danger-border bg-status-danger-bg text-status-danger hover:brightness-95"
                : "border-status-warning-border bg-status-warning-bg text-status-warning hover:brightness-95",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-brand-white",
                semTarifaNenhuma.length > 0 ? "bg-status-danger" : "bg-status-warning",
              )}
            >
              {semValorNoCadastro.length + semTarifaNenhuma.length}
            </span>
            Vale-transporte {avisosAbertos ? "▴" : "▾"}
          </button>

          {avisosAbertos && (
            <div className="absolute top-full left-0 z-50 mt-1.5 w-[min(46rem,calc(100vw-3rem))] space-y-2 rounded-xl border border-hairline bg-background p-3 shadow-lg dark:border-brand-neutral/30">
              {semValorNoCadastro.length > 0 && (
                <RiskCallout nivel="atencao">
                  <strong>
                    {semValorNoCadastro.length} colaborador(es) com VT sem valor por dia útil no Quadro de
                    Colaboradores.
                  </strong>{" "}
                  O cálculo abaixo está usando a tarifa padrão da cidade para essas pessoas, então alterar o cadastro
                  delas não muda o valor aqui enquanto o campo continuar vazio:{" "}
                  {semValorNoCadastro.map((l) => l.nome).join(", ")}.
                </RiskCallout>
              )}

              {semTarifaNenhuma.length > 0 && (
                <RiskCallout nivel="critico">
                  <strong>{semTarifaNenhuma.length} colaborador(es) estão com VT R$ 0,00.</strong> Não há valor por dia
                  no cadastro nem tarifa conhecida para a cidade, e o portal não arbitra valor de folha:{" "}
                  {semTarifaNenhuma.map((l) => l.nome).join(", ")}.
                </RiskCallout>
              )}
            </div>
          )}
        </div>
      )}

      {carregando ? (
        <p className="text-sm text-foreground-muted">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p className="rounded-xl border border-hairline bg-background p-5 text-sm text-foreground-muted dark:border-brand-neutral/30">
          Nenhum colaborador encontrado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-hairline bg-background dark:border-brand-neutral/30">
          <table className="w-full min-w-[720px] text-[12.5px]">
            <thead>
              <tr className="border-b border-hairline text-left text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">
                <th className="px-4 py-2">Colaborador</th>
                <th className="px-4 py-2 text-right">Transporte</th>
                <th className="px-4 py-2 text-right">Alimentação</th>
                <th className="px-4 py-2 text-right">Variáveis</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => (
                <tr key={l.colaboradorId} className="border-b border-hairline/60 last:border-0">
                  <td className="px-4 py-2">
                    <div className="font-semibold text-foreground-muted">{l.nome}</div>
                    <div className="text-[10.5px] text-foreground-muted">
                      {l.vinculo ?? "—"} · {l.departamento ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="text-foreground">{formatarMoeda(l.valeTransporte)}</div>
                    <div className="text-[10.5px] text-foreground-muted">
                      {rotuloVale(l.tipoTransporte)} · {l.cidade ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-[#2b82c2]">{formatarMoeda(l.valeAlimentacao)}</td>
                  <td className="px-4 py-2 text-right">
                    {l.variaveisItens.length === 0 ? (
                      <span className="text-foreground-muted">{formatarMoeda(0)}</span>
                    ) : (
                      <div
                        className="relative inline-block cursor-default"
                        onMouseEnter={() => setColaboradorHover(l.colaboradorId)}
                        onMouseLeave={() => setColaboradorHover((atual) => (atual === l.colaboradorId ? null : atual))}
                      >
                        <span className="text-foreground underline decoration-dotted underline-offset-2">
                          {formatarMoeda(l.variaveis)}
                        </span>
                        {colaboradorHover === l.colaboradorId && (
                          <div className="absolute top-full right-0 z-30 mt-1.5 w-64 rounded-md border border-hairline bg-background py-1.5 text-left shadow-drawer">
                            <p className="px-3 pb-1 text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">
                              Discriminação
                            </p>
                            <ul>
                              {l.variaveisItens.map((item, i) => (
                                <li key={i} className="border-t border-hairline/60 px-3 py-1.5 first:border-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-semibold text-foreground">
                                      {ROTULO_CATEGORIA_VARIAVEL[item.categoria]}
                                    </span>
                                    <span className="text-[11px] text-foreground">{formatarMoeda(item.valor)}</span>
                                  </div>
                                  {item.motivo && (
                                    <p className="mt-0.5 text-[10.5px] text-foreground-muted">{item.motivo}</p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-foreground">
                    {formatarMoeda(l.valeTransporte + l.valeAlimentacao + l.variaveis)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10.5px] text-foreground-muted">{diasUteis} dias úteis em {competenciaLonga(competencia)}</p>

      {importarAberto && (
        <ImportarRateioModal
          competenciaInicial={competencia}
          onFechar={() => setImportarAberto(false)}
          onImportado={() => void recarregar()}
        />
      )}

      {importarVariaveisAberto && (
        <ImportarVariaveisModal
          competenciaInicial={competencia}
          onFechar={() => setImportarVariaveisAberto(false)}
          onImportado={() => void recarregar()}
        />
      )}
    </div>
  );
}

function ImportarRateioModal({
  competenciaInicial,
  onFechar,
  onImportado,
}: {
  competenciaInicial: string;
  onFechar: () => void;
  onImportado: () => void;
}) {
  const [mesReferencia, setMesReferencia] = useState(competenciaInicial);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    aplicadas: number;
    descartados: { linha: number; motivo: string }[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function aplicar() {
    if (!arquivo) {
      setErro("Anexe a planilha antes de continuar.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      formData.append("competencia", mesReferencia);
      const res = await fetch("/api/beneficios/rateio/importar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao ler a planilha.");
        return;
      }
      setResultado(data);
      onImportado();
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      eyebrow="Benefícios · Rateio"
      titulo="Importar rateio"
      subtitulo="Atualiza Transporte e Alimentação de cada colaborador na competência escolhida"
      rodape={
        <>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-md border border-hairline px-4 py-2 text-sm text-foreground-muted hover:bg-surface-page dark:border-brand-neutral/30"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aplicar}
            disabled={enviando || !arquivo}
            className="ml-auto rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-brand-white hover:bg-brand-primary-700 disabled:opacity-50"
          >
            {enviando ? "Lendo..." : `✓ Ler planilha e aplicar em ${competenciaLonga(mesReferencia)}`}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2 rounded border border-hairline bg-surface-page px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-foreground-muted">
            A leitura identifica as colunas Transporte e Alimentação pelo cabeçalho (não pela posição) e casa cada
            linha por código ou nome do colaborador.
          </p>
          <a
            href="/api/beneficios/rateio/modelo"
            download
            className="shrink-0 text-[11px] font-semibold text-brand-primary-800 hover:underline"
          >
            Baixar modelo
          </a>
        </div>

        <label className="block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
          Mês de referência da planilha
          <input
            type="month"
            value={mesReferencia}
            onChange={(e) => setMesReferencia(e.target.value)}
            className="mt-1 w-full rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[12px] font-normal text-foreground normal-case"
          />
        </label>

        <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border-2 border-dashed border-hairline px-4 py-5 text-center hover:border-brand-primary">
          <span aria-hidden className="text-xl text-brand-primary">
            ☁
          </span>
          <span className="text-[12px] font-medium text-foreground">
            {arquivo ? arquivo.name : "Arraste a planilha aqui ou clique para anexar"}
          </span>
          <span className="text-[10px] text-foreground-muted">XLSX, XLS ou CSV · até 10 MB</span>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              setResultado(null);
              setErro(null);
              setArquivo(e.target.files?.[0] ?? null);
            }}
          />
        </label>

        {erro && <RiskCallout nivel="critico">{erro}</RiskCallout>}
        {resultado && (
          <RiskCallout nivel="sucesso">
            {resultado.aplicadas} linha(s) aplicada(s)
            {resultado.descartados.length > 0 && (
              <>
                <br />
                {resultado.descartados.length} linha(s) descartada(s):
                <ul className="mt-1 list-inside list-disc">
                  {resultado.descartados.slice(0, 5).map((d, i) => (
                    <li key={i}>
                      Linha {d.linha}: {d.motivo}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </RiskCallout>
        )}
      </div>
    </Modal>
  );
}

function ImportarVariaveisModal({
  competenciaInicial,
  onFechar,
  onImportado,
}: {
  competenciaInicial: string;
  onFechar: () => void;
  onImportado: () => void;
}) {
  const [mesReferencia, setMesReferencia] = useState(competenciaInicial);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    aplicadas: number;
    descartados: { linha: number; motivo: string }[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function aplicar() {
    if (!arquivo) {
      setErro("Anexe a planilha antes de continuar.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      formData.append("competencia", mesReferencia);
      const res = await fetch("/api/beneficios/variaveis", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao ler a planilha.");
        return;
      }
      setResultado(data);
      onImportado();
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      eyebrow="Benefícios · Rateio"
      titulo="Importar variáveis"
      subtitulo="Soma valores avulsos de Transporte, Mobilidade e Alimentação ao total já lançado de cada colaborador"
      rodape={
        <>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-md border border-hairline px-4 py-2 text-sm text-foreground-muted hover:bg-surface-page dark:border-brand-neutral/30"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aplicar}
            disabled={enviando || !arquivo}
            className="ml-auto rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-brand-white hover:bg-brand-primary-700 disabled:opacity-50"
          >
            {enviando ? "Lendo..." : `✓ Ler planilha e somar em ${competenciaLonga(mesReferencia)}`}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2 rounded border border-hairline bg-surface-page px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-foreground-muted">
            Cada planilha importada é somada às anteriores — não substitui valores já lançados. A leitura identifica
            as colunas pelo cabeçalho (não pela posição) e casa cada linha por código ou nome do colaborador.
          </p>
          <a
            href="/api/beneficios/variaveis/modelo"
            download
            className="shrink-0 text-[11px] font-semibold text-brand-primary-800 hover:underline"
          >
            Baixar modelo
          </a>
        </div>

        <label className="block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
          Mês de referência da planilha
          <input
            type="month"
            value={mesReferencia}
            onChange={(e) => setMesReferencia(e.target.value)}
            className="mt-1 w-full rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[12px] font-normal text-foreground normal-case"
          />
        </label>

        <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border-2 border-dashed border-hairline px-4 py-5 text-center hover:border-brand-primary">
          <span aria-hidden className="text-xl text-brand-primary">
            ☁
          </span>
          <span className="text-[12px] font-medium text-foreground">
            {arquivo ? arquivo.name : "Arraste a planilha aqui ou clique para anexar"}
          </span>
          <span className="text-[10px] text-foreground-muted">XLSX, XLS ou CSV · até 10 MB</span>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              setResultado(null);
              setErro(null);
              setArquivo(e.target.files?.[0] ?? null);
            }}
          />
        </label>

        {erro && <RiskCallout nivel="critico">{erro}</RiskCallout>}
        {resultado && (
          <RiskCallout nivel="sucesso">
            {resultado.aplicadas} linha(s) aplicada(s)
            {resultado.descartados.length > 0 && (
              <>
                <br />
                {resultado.descartados.length} linha(s) descartada(s):
                <ul className="mt-1 list-inside list-disc">
                  {resultado.descartados.slice(0, 5).map((d, i) => (
                    <li key={i}>
                      Linha {d.linha}: {d.motivo}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </RiskCallout>
        )}
      </div>
    </Modal>
  );
}
