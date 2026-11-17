"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { formatarDataBr } from "@/lib/format";
import { useSessaoResumo } from "@/lib/authClient";
import type { CategoriaDocDp } from "@/lib/docDp";
import type { DocumentoDocDp } from "@/lib/db/docDp";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Biblioteca de documentos de um módulo: um cartão por mês do ano escolhido. Só o administrador anexa/exclui. */
export function DocumentosPorMes({ categoria }: { categoria: CategoriaDocDp }) {
  const admin = useSessaoResumo()?.tipo === "administrador";
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [documentos, setDocumentos] = useState<DocumentoDocDp[]>([]);
  const [enviandoMes, setEnviandoMes] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mesAberto, setMesAberto] = useState<number | null>(null);
  const competenciaAberta = mesAberto ? `${ano}-${String(mesAberto).padStart(2, "0")}` : "";
  const docsDoMes = documentos.filter((d) => d.competencia === competenciaAberta);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/doc-dp/${categoria}/documentos?ano=${ano}`);
      setDocumentos(r.ok ? ((await r.json()) as { documentos: DocumentoDocDp[] }).documentos : []);
    } catch {
      setDocumentos([]);
    }
  }, [categoria, ano]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  async function anexar(competencia: string, arquivos: File[]) {
    if (arquivos.length === 0) return;
    setEnviandoMes(competencia);
    setErro(null);
    try {
      const form = new FormData();
      form.append("competencia", competencia);
      for (const a of arquivos) form.append("arquivos", a);
      const r = await fetch(`/api/doc-dp/${categoria}/documentos`, { method: "POST", body: form });
      if (r.status === 413) {
        throw new Error("Arquivo grande demais para enviar de uma vez (limite do servidor: cerca de 4,5 MB no total). Envie menos arquivos por vez ou reduza o tamanho do PDF.");
      }
      const d = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) throw new Error(d.erro ?? "Falha ao anexar.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao anexar.");
    } finally {
      setEnviandoMes(null);
    }
  }

  async function remover(d: DocumentoDocDp) {
    if (!window.confirm(`Remover "${d.nome}"?`)) return;
    await fetch(`/api/doc-dp/${categoria}/documentos/${d.id}`, { method: "DELETE" });
    await carregar();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAno((a) => a - 1)}
          aria-label="Ano anterior"
          className="rounded border border-hairline px-2.5 py-1 text-[13px] text-foreground-muted hover:bg-surface-page"
        >
          ‹
        </button>
        <span className="min-w-[3.5rem] text-center text-[15px] font-bold text-brand-primary-800">{ano}</span>
        <button
          type="button"
          onClick={() => setAno((a) => a + 1)}
          aria-label="Próximo ano"
          className="rounded border border-hairline px-2.5 py-1 text-[13px] text-foreground-muted hover:bg-surface-page"
        >
          ›
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {MESES.map((nome, i) => {
          const competencia = `${ano}-${String(i + 1).padStart(2, "0")}`;
          const qtd = documentos.filter((d) => d.competencia === competencia).length;
          return (
            <button
              key={competencia}
              type="button"
              onClick={() => setMesAberto(i + 1)}
              className="rounded-xl border border-hairline bg-background px-3 py-3 text-left shadow-card transition-colors hover:border-brand-primary hover:bg-surface-page"
            >
              <span className="block text-[18px] leading-none" aria-hidden>📁</span>
              <span className="mt-1.5 block text-[12px] font-bold tracking-wide text-brand-primary-800 uppercase">{nome}</span>
              <span className="block text-[11px] text-foreground-muted">
                {qtd} {qtd === 1 ? "arquivo" : "arquivos"}
              </span>
            </button>
          );
        })}
      </div>

      <Modal
        aberto={mesAberto !== null}
        onFechar={() => setMesAberto(null)}
        eyebrow="Documentos"
        titulo={mesAberto ? `${MESES[mesAberto - 1].toUpperCase()} / ${ano}` : ""}
        subtitulo={`${docsDoMes.length} ${docsDoMes.length === 1 ? "arquivo anexado" : "arquivos anexados"}`}
        largura="44rem"
        rodape={
          <>
            <span className="flex-1 text-[11.5px] text-foreground-muted">Pasta · {MESES[(mesAberto ?? 1) - 1]} de {ano}</span>
            <button
              type="button"
              onClick={() => setMesAberto(null)}
              className="rounded-md border border-hairline bg-background px-4 py-1.5 text-[12.5px] text-foreground-muted hover:bg-surface-page"
            >
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
                    {admin && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody>
                  {docsDoMes.length === 0 ? (
                    <tr>
                      <td colSpan={admin ? 3 : 2} className="px-3 py-4 text-center text-foreground-muted">
                        Nenhum documento nesta pasta.
                      </td>
                    </tr>
                  ) : (
                    docsDoMes.map((d) => (
                      <tr key={d.id} className="border-t border-hairline/60 even:bg-surface-page">
                        <td className="max-w-0 px-3 py-2">
                          <a
                            href={`/api/doc-dp/${categoria}/documentos/${d.id}`}
                            target="_blank"
                            rel="noreferrer"
                            title={d.nome}
                            className="block truncate text-brand-primary hover:underline"
                          >
                            {d.nome}
                          </a>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-foreground-muted">{formatarDataBr(d.criadoEm.slice(0, 10))}</td>
                        {admin && (
                          <td className="pr-3 text-center">
                            <button type="button" title="Excluir" onClick={() => void remover(d)} className="text-foreground-muted hover:text-status-danger">
                              ✕
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {admin && (
              <label className="inline-flex cursor-pointer items-center rounded-md bg-brand-primary px-4 py-2 text-[12.5px] font-medium text-brand-white hover:bg-brand-primary-hover">
                {enviandoMes === competenciaAberta ? "Enviando..." : "Anexar documentos"}
                <input
                  type="file"
                  multiple
                  disabled={enviandoMes !== null}
                  accept="application/pdf,image/png,image/jpeg,.xls,.xlsx,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const arquivos = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    void anexar(competenciaAberta, arquivos);
                  }}
                />
              </label>
            )}
            {erro && <p className="text-[12px] text-status-danger">{erro}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
