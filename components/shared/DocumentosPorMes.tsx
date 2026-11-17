"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/shared/Card";
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
      const d = await r.json();
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
      {erro && <p className="text-[12px] text-status-danger">{erro}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MESES.map((nome, i) => {
          const competencia = `${ano}-${String(i + 1).padStart(2, "0")}`;
          const docs = documentos.filter((d) => d.competencia === competencia);
          return (
            <Card key={competencia} className="flex flex-col p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-bold tracking-wide text-brand-primary-800 uppercase">{nome}</p>
                <span className="text-[11px] text-foreground-muted">{docs.length} {docs.length === 1 ? "arquivo" : "arquivos"}</span>
              </div>

              {docs.length === 0 ? (
                <p className="text-[12px] text-foreground-muted">Nenhum documento.</p>
              ) : (
                <ul className="space-y-1">
                  {docs.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 rounded border border-hairline px-2 py-1">
                      <a
                        href={`/api/doc-dp/${categoria}/documentos/${d.id}`}
                        target="_blank"
                        rel="noreferrer"
                        title={d.nome}
                        className="min-w-0 flex-1 truncate text-[12px] text-brand-primary hover:underline"
                      >
                        {d.nome}
                      </a>
                      {admin && (
                        <button type="button" title="Excluir" onClick={() => void remover(d)} className="text-[11px] text-foreground-muted hover:text-status-danger">
                          ✕
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {admin && (
                <label className="mt-2 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-brand-primary/50 px-3 py-2 text-[12px] font-medium text-brand-primary hover:bg-brand-primary-050">
                  {enviandoMes === competencia ? "Enviando..." : "📎 Anexar documentos"}
                  <input
                    type="file"
                    multiple
                    disabled={enviandoMes !== null}
                    accept="application/pdf,image/png,image/jpeg,.xls,.xlsx,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const arquivos = Array.from(e.target.files ?? []);
                      e.target.value = "";
                      void anexar(competencia, arquivos);
                    }}
                  />
                </label>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
