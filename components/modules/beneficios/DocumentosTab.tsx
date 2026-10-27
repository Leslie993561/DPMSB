"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/shared/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/lib/cn";
import type { DocumentoBeneficio } from "@/lib/db/beneficiosDocumentos";

const FORNECEDORES = ["Sólides", "Flash", "Porto Seguro", "TotalPass"] as const;
const INPUT_CLASS =
  "mt-1 w-full rounded border border-hairline bg-background px-2.5 py-1.5 text-[12px] font-normal normal-case text-foreground outline-none focus:border-brand-primary";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const rotuloMes = (competencia: string) => `${MESES[Number(competencia.slice(5, 7)) - 1]}/${competencia.slice(0, 4)}`;

/** Anexa os documentos mensais (faturas, notas, boletos, contratos) de cada fornecedor de benefício. */
export function DocumentosTab() {
  const [documentos, setDocumentos] = useState<DocumentoBeneficio[]>([]);
  const [fornecedor, setFornecedor] = useState<string>(FORNECEDORES[0]);
  const [competencia, setCompetencia] = useState(() => new Date().toISOString().slice(0, 7));
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [filtro, setFiltro] = useState<string>("todos");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch("/api/beneficios/documentos");
    if (r.ok) setDocumentos(((await r.json()) as { documentos: DocumentoBeneficio[] }).documentos);
  }, []);

  useEffect(() => {
    fetch("/api/beneficios/documentos")
      .then((r) => (r.ok ? r.json() : { documentos: [] }))
      .then((d) => setDocumentos(d.documentos ?? []))
      .catch(() => setDocumentos([]));
  }, []);

  async function enviar() {
    if (arquivos.length === 0) {
      setErro("Anexe ao menos um arquivo.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const form = new FormData();
      form.append("fornecedor", fornecedor);
      form.append("competencia", competencia);
      for (const a of arquivos) form.append("arquivos", a);
      const r = await fetch("/api/beneficios/documentos", { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "Falha ao anexar.");
      setArquivos([]);
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

  const visiveis = documentos.filter((d) => filtro === "todos" || d.fornecedor === filtro);
  const porMes = Array.from(
    visiveis.reduce((mapa, d) => mapa.set(d.competencia, [...(mapa.get(d.competencia) ?? []), d]), new Map<string, DocumentoBeneficio[]>()),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Benefícios"
        titulo="Documentos"
        subtitulo="Documentos mensais dos benefícios e contratos: Sólides, Flash, Porto Seguro e TotalPass"
      />

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card className="h-fit p-4">
          <p className="mb-3 text-[12px] font-bold tracking-wide text-foreground-muted uppercase">Anexar documentos</p>
          <div className="space-y-3">
            <label className="block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
              Fornecedor
              <select value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className={INPUT_CLASS}>
                {FORNECEDORES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
              Mês
              <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} className={INPUT_CLASS} />
            </label>
            <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-brand-primary/50 px-3 py-3 text-[12px] font-medium text-brand-primary hover:bg-brand-primary-050">
              📎 Selecionar arquivos
              <input
                type="file"
                multiple
                accept="application/pdf,image/png,image/jpeg,.xls,.xlsx"
                className="hidden"
                onChange={(e) => {
                  setArquivos((atual) => [...atual, ...Array.from(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
            </label>
            {arquivos.length > 0 && (
              <ul className="space-y-1 text-[12px]">
                {arquivos.map((a, i) => (
                  <li key={`${a.name}-${i}`} className="flex items-center gap-2 rounded border border-hairline px-2 py-1">
                    <span className="min-w-0 flex-1 truncate text-foreground">{a.name}</span>
                    <button
                      type="button"
                      onClick={() => setArquivos((atual) => atual.filter((_, j) => j !== i))}
                      aria-label={`Remover ${a.name}`}
                      className="text-foreground-muted hover:text-status-danger"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {erro && <p className="text-[11px] text-status-danger">{erro}</p>}
            <button
              type="button"
              disabled={enviando || arquivos.length === 0}
              onClick={() => void enviar()}
              className="w-full rounded bg-brand-primary px-3 py-2 text-[12.5px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {enviando ? "Enviando..." : "Anexar"}
            </button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {["todos", ...FORNECEDORES].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                  filtro === f ? "border-brand-primary bg-brand-primary text-brand-white" : "border-hairline text-foreground-muted hover:bg-surface-page",
                )}
              >
                {f === "todos" ? "Todos" : f}
              </button>
            ))}
          </div>

          {porMes.length === 0 ? (
            <p className="text-[12px] text-foreground-muted">Nenhum documento anexado.</p>
          ) : (
            <div className="space-y-3">
              {porMes.map(([mes, docs]) => (
                <div key={mes} className="rounded border border-hairline">
                  <div className="bg-surface-page px-2.5 py-1 text-[11px] font-semibold text-brand-primary-800">{rotuloMes(mes)}</div>
                  {docs.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 border-t border-hairline px-2.5 py-1.5">
                      <span className="w-24 shrink-0 text-[11px] font-semibold text-foreground">{d.fornecedor}</span>
                      <a
                        href={`/api/beneficios/documentos/${d.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate text-[12px] text-brand-primary hover:underline"
                        title={d.nome}
                      >
                        {d.nome}
                      </a>
                      <button type="button" title="Excluir" onClick={() => void remover(d)} className="text-[11px] text-foreground-muted hover:text-status-danger">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
