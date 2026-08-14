"use client";

import { useState } from "react";
import type { CampoDetectado, HoleritePdfParseado } from "@/lib/parsing/pdf";
import { RiskCallout } from "@/components/shared/RiskCallout";
import { formatarMoeda } from "@/lib/format";

const ROTULOS: Record<CampoDetectado["campo"], string> = {
  salarioBase: "Salário base",
  inss: "INSS",
  irrf: "IRRF",
  fgts: "FGTS",
  liquido: "Líquido",
};

/**
 * Upload de holerite em PDF. Os valores extraídos são sempre apresentados como
 * PALPITE para conferência — nada é enviado ao assistente ou a um cálculo sem
 * que o usuário revise e confirme explicitamente.
 */
export function HoleriteUpload({
  onConfirmar,
}: {
  onConfirmar: (resumo: string) => void;
}) {
  const [resultado, setResultado] = useState<HoleritePdfParseado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [mostrarTexto, setMostrarTexto] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setErro(null);
    setResultado(null);
    setCarregando(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      const res = await fetch("/api/upload/pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao ler o PDF.");
        return;
      }
      setResultado(data);
    } catch {
      setErro("Falha ao enviar o arquivo.");
    } finally {
      setCarregando(false);
    }
  }

  function confirmar() {
    if (!resultado) return;
    const linhas = resultado.camposDetectados
      .filter((c) => c.valor !== null)
      .map((c) => `${ROTULOS[c.campo]}: ${formatarMoeda(c.valor as number)}`);

    onConfirmar(
      linhas.length > 0
        ? `Valores conferidos de um holerite:\n${linhas.join("\n")}\n\nAnalise se há inconsistências.`
        : "Enviei um holerite em PDF, mas nenhum valor pôde ser extraído automaticamente.",
    );
    setResultado(null);
  }

  return (
    <div className="space-y-3 rounded-xl border border-brand-surface bg-background p-5 dark:border-brand-neutral/30">
      <label className="flex flex-col gap-1 text-sm text-foreground-muted">
        Holerite em PDF (opcional — máx. 10 MB)
        <input
          type="file"
          accept=".pdf"
          onChange={handleUpload}
          className="w-full rounded-md border border-brand-surface bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-brand-primary file:px-3 file:py-1 file:text-brand-white dark:border-brand-neutral/30"
        />
      </label>

      {carregando && <p className="text-sm text-foreground-muted">Lendo o PDF...</p>}
      {erro && <RiskCallout nivel="critico">{erro}</RiskCallout>}

      {resultado?.semCamadaDeTexto && (
        <RiskCallout nivel="critico">
          Não foi possível extrair texto deste PDF automaticamente — provavelmente é uma imagem
          digitalizada. Leitura de PDFs escaneados (OCR) não é suportada nesta versão. Digite os
          valores manualmente na conversa.
        </RiskCallout>
      )}

      {resultado && !resultado.semCamadaDeTexto && (
        <div className="space-y-3">
          <RiskCallout nivel="atencao">
            Os valores abaixo foram detectados automaticamente e são apenas um PALPITE — layouts de
            holerite variam muito entre sistemas de folha. Confira cada valor contra o documento
            original antes de confirmar.
          </RiskCallout>

          <table className="w-full text-sm">
            <tbody>
              {resultado.camposDetectados.map((c) => (
                <tr key={c.campo} className="border-b border-brand-surface/60 last:border-0 dark:border-brand-neutral/20">
                  <td className="py-1.5 text-foreground">{ROTULOS[c.campo]}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums text-foreground">
                    {c.valor !== null ? formatarMoeda(c.valor) : "— não detectado —"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmar}
              className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-brand-white transition-colors hover:bg-brand-primary-hover"
            >
              Confirmar e enviar ao assistente
            </button>
            <button
              type="button"
              onClick={() => setMostrarTexto(!mostrarTexto)}
              className="rounded-md border border-brand-surface px-4 py-2 text-sm text-foreground-muted transition-colors hover:bg-brand-surface dark:border-brand-neutral/30"
            >
              {mostrarTexto ? "Ocultar" : "Ver"} texto extraído
            </button>
          </div>

          {mostrarTexto && (
            <pre className="max-h-64 overflow-auto rounded-md border border-brand-surface bg-brand-surface/30 p-3 text-xs whitespace-pre-wrap text-foreground-muted dark:border-brand-neutral/30 dark:bg-brand-neutral/10">
              {resultado.textoBruto}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
