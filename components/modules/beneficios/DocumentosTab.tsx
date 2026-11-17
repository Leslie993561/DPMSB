"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/shared/Card";
import { Modal } from "@/components/shared/Modal";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatarDataBr } from "@/lib/format";
import type { DocumentoBeneficio } from "@/lib/db/beneficiosDocumentos";

const FORNECEDORES = ["Sólides", "Flash", "Porto Seguro"] as const;
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Faturas e contratos dos benefícios: escolhe o fornecedor, depois o ano e o mês (pasta) onde anexar. */
export function DocumentosTab() {
  const [documentos, setDocumentos] = useState<DocumentoBeneficio[]>([]);
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [aberto, setAberto] = useState<{ fornecedor: string; mes: number } | null>(null);
  const mesAberto = aberto?.mes ?? null;
  const fornecedor = aberto?.fornecedor ?? FORNECEDORES[0];
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/beneficios/documentos");
      setDocumentos(r.ok ? ((await r.json()) as { documentos: DocumentoBeneficio[] }).documentos : []);
    } catch {
      setDocumentos([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  const competencia = (mes: number) => `${ano}-${String(mes).padStart(2, "0")}`;
  const doMes = (forn: string, mes: number) => documentos.filter((d) => d.fornecedor === forn && d.competencia === competencia(mes));
  const docsAbertos = mesAberto ? doMes(fornecedor, mesAberto) : [];

  async function anexar(arquivos: File[]) {
    if (!mesAberto || arquivos.length === 0) return;
    setEnviando(true);
    setErro(null);
    try {
      const form = new FormData();
      form.append("fornecedor", fornecedor);
      form.append("competencia", competencia(mesAberto));
      for (const a of arquivos) form.append("arquivos", a);
      const r = await fetch("/api/beneficios/documentos", { method: "POST", body: form });
      if (r.status === 413) {
        throw new Error("Arquivo grande demais para enviar de uma vez (limite do servidor: cerca de 4,5 MB no total). Envie menos arquivos por vez ou reduza o tamanho do PDF.");
      }
      const d = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) throw new Error(d.erro ?? "Falha ao anexar.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao anexar.");
    } finally {
      setEnviando(false);
    }
  }

  async function remover(d: DocumentoBeneficio) {
    if (!window.confirm(`Remover "${d.nome}"?`)) return;
    await fetch(`/api/beneficios/documentos/${d.id}`, { method: "DELETE" });
    await carregar();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Benefícios"
        titulo="Faturas e contratos"
        subtitulo="Documentos mensais dos benefícios e contratos: Sólides, Flash e Porto Seguro"
      />

      <div className="flex items-center gap-2">
          <button type="button" onClick={() => setAno((a) => a - 1)} aria-label="Ano anterior" className="rounded border border-hairline px-2 py-0.5 text-[12px] text-foreground-muted hover:bg-surface-page">
            ‹
          </button>
          <span className="min-w-[3rem] text-center text-[14px] font-bold text-brand-primary-800">{ano}</span>
          <button type="button" onClick={() => setAno((a) => a + 1)} aria-label="Próximo ano" className="rounded border border-hairline px-2 py-0.5 text-[12px] text-foreground-muted hover:bg-surface-page">
            ›
          </button>
        </div>

        {FORNECEDORES.map((forn) => (
          <Card key={forn} className="space-y-2 p-4">
            <h2 className="text-[11px] font-bold tracking-wide text-brand-primary-800 uppercase">{forn}</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-12">
              {MESES.map((nome, i) => {
                const qtd = doMes(forn, i + 1).length;
                return (
                  <button
                    key={nome}
                    type="button"
                    onClick={() => {
                      setErro(null);
                      setAberto({ fornecedor: forn, mes: i + 1 });
                    }}
                    className="rounded-lg border border-hairline bg-background px-2 py-1.5 text-left transition-colors hover:border-brand-primary hover:bg-surface-page"
                  >
                    <span className="block text-[13px] leading-none" aria-hidden>📁</span>
                    <span className="mt-1 block text-[10.5px] font-bold tracking-wide text-brand-primary-800 uppercase">{nome.slice(0, 3)}</span>
                    <span className="block text-[10px] text-foreground-muted">
                      {qtd} {qtd === 1 ? "arquivo" : "arquivos"}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        ))}

      <Modal
        aberto={aberto !== null}
        onFechar={() => setAberto(null)}
        eyebrow={fornecedor}
        titulo={mesAberto ? `${MESES[mesAberto - 1].toUpperCase()} / ${ano}` : ""}
        subtitulo={`${docsAbertos.length} ${docsAbertos.length === 1 ? "arquivo anexado" : "arquivos anexados"}`}
        largura="44rem"
        rodape={
          <>
            <span className="flex-1 text-[11.5px] text-foreground-muted">
              {fornecedor} · {mesAberto ? MESES[mesAberto - 1] : ""} de {ano}
            </span>
            <button type="button" onClick={() => setAberto(null)} className="rounded-md border border-hairline bg-background px-4 py-1.5 text-[12.5px] text-foreground-muted hover:bg-surface-page">
              Fechar
            </button>
          </>
        }
      >
        {mesAberto !== null && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border border-hairline">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-hairline text-left text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
                    <th className="px-3 py-2">Arquivo</th>
                    <th className="px-3 py-2">Anexado em</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {docsAbertos.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-foreground-muted">
                        Nenhum documento nesta pasta.
                      </td>
                    </tr>
                  ) : (
                    docsAbertos.map((d) => (
                      <tr key={d.id} className="border-t border-hairline/60 even:bg-surface-page">
                        <td className="max-w-0 px-3 py-2">
                          <a href={`/api/beneficios/documentos/${d.id}`} target="_blank" rel="noreferrer" title={d.nome} className="block truncate text-brand-primary hover:underline">
                            {d.nome}
                          </a>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-foreground-muted">{formatarDataBr(d.criadoEm.slice(0, 10))}</td>
                        <td className="pr-3 text-center">
                          <button type="button" title="Excluir" onClick={() => void remover(d)} className="text-foreground-muted hover:text-status-danger">
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <label className="inline-flex cursor-pointer items-center rounded-md bg-brand-primary px-4 py-2 text-[12.5px] font-medium text-brand-white hover:bg-brand-primary-hover">
              {enviando ? "Enviando..." : "Anexar documentos"}
              <input
                type="file"
                multiple
                disabled={enviando}
                accept="application/pdf,image/png,image/jpeg,.xls,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const arquivos = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  void anexar(arquivos);
                }}
              />
            </label>
            {erro && <p className="text-[12px] text-status-danger">{erro}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
