"use client";

import { useState } from "react";
import { RiskCallout } from "@/components/shared/RiskCallout";

const COLUNAS = [
  "Código",
  "Nome do colaborador",
  "Centro de custo / Setor",
  "Cargo",
  "Gestor responsável",
  "Salário base",
  "Data de admissão",
  "Aquisitivo início",
  "Aquisitivo fim",
  "Concessivo início",
  "Concessivo fim",
  "Início das férias",
  "Data de retorno",
  "Dias de férias",
  "Abono (Sim/Não)",
  "Dias de abono",
  "Trimestre",
  "Observações",
];

export function LancarProgramacaoModal({
  onFechar,
  onLancarManualmente,
  onSucesso,
}: {
  onFechar: () => void;
  onLancarManualmente: () => void;
  onSucesso: () => void;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    lancados: number;
    periodosCriados: number;
    descartados: { linha: number; motivo: string }[];
  } | null>(null);

  async function validarELancar() {
    if (!arquivo) {
      setErro("Anexe a planilha preenchida primeiro.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      const res = await fetch("/api/programacao-ferias/importar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao ler a planilha.");
        return;
      }
      setResultado(data);
      onSucesso();
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-md border border-hairline bg-background shadow-drawer">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <h3 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
            <span aria-hidden>📋</span> Lançar programação anual
          </h3>
          <button type="button" onClick={onFechar} className="text-foreground-muted hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="max-h-[75vh] space-y-3 overflow-y-auto p-4">
          <div className="flex items-start gap-2.5 rounded border border-hairline bg-surface-page px-3 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary-100 text-[10px] font-bold text-brand-primary-800">
              1
            </span>
            <div className="flex-1">
              <p className="text-[12px] font-medium text-foreground">Baixe o modelo e preencha</p>
              <p className="text-[10.5px] text-foreground-muted">
                Planilha com as 18 colunas na ordem esperada e duas linhas de exemplo já preenchidas.
              </p>
            </div>
            <a
              href="/api/programacao-ferias/modelo"
              download
              className="flex shrink-0 items-center gap-1 rounded border border-brand-primary/40 bg-background px-2.5 py-1.5 text-[11.5px] font-medium text-brand-primary-800 hover:bg-brand-primary-100"
            >
              ↓ Modelo
            </a>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary-100 text-[10px] font-bold text-brand-primary-800">
              2
            </span>
            <div className="flex-1">
              <p className="mb-1.5 text-[12px] font-medium text-foreground">Anexe a planilha preenchida</p>
              <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border-2 border-dashed border-hairline px-4 py-5 text-center hover:border-brand-primary">
                <span aria-hidden className="text-xl text-brand-primary">
                  ⬆
                </span>
                <span className="text-[12px] font-medium text-foreground">
                  {arquivo ? arquivo.name : "Arraste aqui ou clique para anexar"}
                </span>
                <span className="text-[10.5px] text-foreground-muted">
                  XLS, XLSX ou CSV · uma linha por colaborador e período
                </span>
                <input
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
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold tracking-wide text-brand-primary-800 uppercase">Colunas da planilha</p>
            <div className="flex flex-wrap gap-1">
              {COLUNAS.map((c) => (
                <span key={c} className="rounded-full border border-hairline bg-surface-page px-2 py-0.5 text-[10px] text-foreground-muted">
                  {c}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-foreground-muted">
              Datas em dd/mm/aaaa · salário com duas casas · abono como Sim ou Não · trimestre Q1 a Q4. Centro de custo,
              cargo, gestor, salário, admissão, concessivo e trimestre servem só para conferir a linha — não alteram o
              cadastro do colaborador.
            </p>
          </div>

          {erro && <RiskCallout nivel="critico">{erro}</RiskCallout>}

          {resultado && (
            <div className="rounded border border-status-success-bg bg-status-success-bg px-2.5 py-1.5 text-[11px] text-status-success">
              {resultado.lancados} programação(ões) lançada(s) · {resultado.periodosCriados} período(s) novo(s)
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
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-hairline px-4 py-3">
          <button
            type="button"
            onClick={onLancarManualmente}
            className="text-[11.5px] font-medium text-brand-primary hover:text-brand-primary-hover"
          >
            Lançar manualmente
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onFechar}
              className="rounded border border-hairline px-3 py-1.5 text-[12px] font-medium text-foreground-muted hover:bg-surface-page dark:border-brand-neutral/30"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={validarELancar}
              disabled={enviando || !arquivo}
              className="flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {enviando ? "Lançando..." : "✓ Validar e lançar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
