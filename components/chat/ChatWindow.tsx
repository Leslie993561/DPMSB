"use client";

import { useState } from "react";
import type { CalculoResult, MemoriaCalculoStep } from "@/lib/calc";
import { MemoriaCalculoTable } from "@/components/shared/MemoriaCalculoTable";
import { RiskCallout } from "@/components/shared/RiskCallout";
import { StructuredAnswer } from "./StructuredAnswer";
import { HoleriteUpload } from "./HoleriteUpload";

interface ToolCallRecord {
  tool: string;
  input: unknown;
  result: unknown;
  isError: boolean;
}

interface Mensagem {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallRecord[];
}

/** Extrai a memória de cálculo de um resultado de tool, se houver. */
function extrairMemoria(result: unknown): MemoriaCalculoStep[] | null {
  if (!result || typeof result !== "object") return null;
  const memoria = (result as Partial<CalculoResult>).memoriaCalculo;
  return Array.isArray(memoria) ? memoria : null;
}

export function ChatWindow() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [entrada, setEntrada] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    await enviarTexto(entrada.trim());
  }

  async function enviarTexto(texto: string) {
    if (!texto || carregando) return;

    const novasMensagens: Mensagem[] = [...mensagens, { role: "user", content: texto }];
    setMensagens(novasMensagens);
    setEntrada("");
    setErro(null);
    setCarregando(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: novasMensagens.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao consultar o assistente.");
        return;
      }
      setMensagens([
        ...novasMensagens,
        { role: "assistant", content: data.texto, toolCalls: data.toolCalls },
      ]);
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {mensagens.length === 0 && (
          <p className="rounded-xl border border-brand-surface bg-background p-5 text-sm text-foreground-muted dark:border-brand-neutral/30">
            Faça uma pergunta sobre Departamento Pessoal. Cálculos de INSS, IRRF, FGTS, férias, 13º e
            rescisão são executados por um motor determinístico — o assistente interpreta e explica,
            mas não faz as contas por conta própria.
          </p>
        )}

        {mensagens.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-xl bg-brand-primary px-4 py-2 text-sm text-brand-white">
                {m.content}
              </p>
            </div>
          ) : (
            <div
              key={i}
              className="space-y-3 rounded-xl border border-brand-surface bg-background p-5 dark:border-brand-neutral/30"
            >
              <StructuredAnswer texto={m.content} />
              {m.toolCalls?.map((tc, j) => {
                const memoria = extrairMemoria(tc.result);
                if (!memoria) return null;
                return (
                  <MemoriaCalculoTable
                    key={j}
                    passos={memoria}
                    titulo={`Memória de cálculo — ${tc.tool.replace(/_/g, " ")}`}
                  />
                );
              })}
            </div>
          ),
        )}

        {carregando && (
          <p className="text-sm text-foreground-muted">Consultando o assistente...</p>
        )}
        {erro && <RiskCallout nivel="critico">{erro}</RiskCallout>}
      </div>

      <form onSubmit={enviar} className="flex gap-2">
        <input
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="Ex.: calcule as férias de um salário de R$ 3.000 com 30 dias de direito"
          className="flex-1 rounded-md border border-brand-surface bg-background px-3 py-2 text-sm text-foreground dark:border-brand-neutral/30"
        />
        <button
          type="submit"
          disabled={carregando}
          className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-brand-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
        >
          Enviar
        </button>
      </form>

      <HoleriteUpload onConfirmar={(resumo) => void enviarTexto(resumo)} />
    </div>
  );
}
