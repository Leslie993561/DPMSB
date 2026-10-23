"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/shared/Card";
import { formatarDataBr, formatarMoeda } from "@/lib/format";
import type { MelhoriaEmpresa } from "@/lib/db/dho";

const INPUT_CLASS =
  "w-full rounded-md border border-hairline bg-background px-2 py-1.5 text-[12px] text-foreground placeholder:text-foreground-muted/60";

interface LinhaForm {
  chave: number;
  data: string;
  titulo: string;
  quantidade: string;
  valorTotal: string;
}

let proximaChave = 1;
const novaLinha = (): LinhaForm => ({ chave: proximaChave++, data: "", titulo: "", quantidade: "1", valorTotal: "" });

/** Orçamento à parte: melhorias comuns à empresa (sem ação de endomarketing) — data, título, quantidade e valor. */
export function MelhoriasEmpresaCard({ ano }: { ano: number }) {
  const [itens, setItens] = useState<MelhoriaEmpresa[]>([]);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [linhas, setLinhas] = useState<LinhaForm[]>(() => [novaLinha()]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    const res = await fetch(`/api/dho/melhorias?ano=${ano}`);
    if (res.ok) setItens((await res.json()).melhorias ?? []);
  }

  useEffect(() => {
    fetch(`/api/dho/melhorias?ano=${ano}`)
      .then((r) => (r.ok ? r.json() : { melhorias: [] }))
      .then((d) => setItens(d.melhorias ?? []))
      .catch(() => setItens([]));
  }, [ano]);

  function limpar() {
    setEditandoId(null);
    setLinhas([novaLinha()]);
    setErro(null);
  }

  function editar(m: MelhoriaEmpresa) {
    setEditandoId(m.id);
    setLinhas([{ chave: proximaChave++, data: m.data, titulo: m.titulo, quantidade: String(m.quantidade), valorTotal: String(m.valorTotal) }]);
    setErro(null);
  }

  function mudar(chave: number, campo: keyof Omit<LinhaForm, "chave">, valor: string) {
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)));
  }

  const paraCorpo = (l: LinhaForm) => ({ data: l.data, titulo: l.titulo, quantidade: Number(l.quantidade), valorTotal: Number(l.valorTotal) || 0 });
  const linhaCompleta = (l: LinhaForm) => l.data !== "" && l.titulo.trim() !== "";

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const res = editandoId
        ? await fetch(`/api/dho/melhorias/${editandoId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(paraCorpo(linhas[0])),
          })
        : await fetch("/api/dho/melhorias", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itens: linhas.map(paraCorpo) }),
          });
      if (!res.ok) {
        setErro((await res.json().catch(() => ({}))).erro ?? "Não foi possível salvar.");
        return;
      }
      limpar();
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: number) {
    await fetch(`/api/dho/melhorias/${id}`, { method: "DELETE" });
    if (editandoId === id) limpar();
    await carregar();
  }

  const total = itens.reduce((soma, m) => soma + m.valorTotal, 0);

  return (
    <Card className="p-4">
      <p className="text-[11px] font-bold tracking-wide text-foreground-muted uppercase">Melhorias para a empresa · {ano}</p>
      <p className="mb-2 text-[10.5px] text-foreground-muted">Itens comuns a todos, sem ação de endomarketing.</p>

      <div className="space-y-2">
        {linhas.map((l, idx) => (
          <div key={l.chave} className="space-y-1.5 rounded border border-hairline p-2">
            <div className="grid grid-cols-[1fr_1.4fr] gap-1.5">
              <label className="block">
                <span className="mb-0.5 block text-[10px] font-medium text-foreground-muted">Data</span>
                <input type="date" value={l.data} onChange={(e) => mudar(l.chave, "data", e.target.value)} className={INPUT_CLASS} />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10px] font-medium text-foreground-muted">Título</span>
                <input value={l.titulo} onChange={(e) => mudar(l.chave, "titulo", e.target.value)} className={INPUT_CLASS} />
              </label>
            </div>
            <div className="grid grid-cols-[1fr_1.4fr_auto] items-end gap-1.5">
              <label className="block">
                <span className="mb-0.5 block text-[10px] font-medium text-foreground-muted">Qnt.</span>
                <input type="number" min={1} step={1} value={l.quantidade} onChange={(e) => mudar(l.chave, "quantidade", e.target.value)} className={INPUT_CLASS} />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10px] font-medium text-foreground-muted">Valor total (R$)</span>
                <input type="number" min={0} step="0.01" value={l.valorTotal} onChange={(e) => mudar(l.chave, "valorTotal", e.target.value)} className={INPUT_CLASS} />
              </label>
              {linhas.length > 1 && !editandoId && (
                <button
                  type="button"
                  title="Remover linha"
                  onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                  className="pb-1.5 text-[12px] text-foreground-muted hover:text-status-danger"
                  aria-label={`Remover linha ${idx + 1}`}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}

        {!editandoId && (
          <button
            type="button"
            onClick={() => setLinhas((ls) => [...ls, novaLinha()])}
            className="text-[11.5px] font-medium text-brand-primary hover:text-brand-primary-hover"
          >
            + Adicionar outro
          </button>
        )}

        {erro && <p className="text-[11px] text-status-danger">{erro}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={salvando || !linhas.every(linhaCompleta)}
            onClick={salvar}
            className="flex-1 rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : linhas.length > 1 ? `Salvar ${linhas.length} itens` : "Salvar"}
          </button>
          {editandoId && (
            <button type="button" onClick={limpar} className="text-[11px] text-brand-primary hover:text-brand-primary-hover">
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
        {itens.length === 0 ? (
          <p className="text-[12px] text-foreground-muted">Nenhuma melhoria cadastrada.</p>
        ) : (
          itens.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-2 rounded border border-hairline px-2.5 py-1.5">
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold text-brand-primary-800">{formatarDataBr(m.data)}</p>
                <p className="truncate text-[12px] text-foreground">{m.titulo}</p>
                <p className="text-[10.5px] text-foreground-muted">
                  Qnt. {m.quantidade} · {formatarMoeda(m.valorTotal)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" title="Editar" onClick={() => editar(m)} className="text-[11px] text-foreground-muted hover:text-brand-primary">
                  ✎
                </button>
                <button type="button" title="Excluir" onClick={() => excluir(m.id)} className="text-[11px] text-foreground-muted hover:text-status-danger">
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {itens.length > 0 && <p className="mt-2 text-right text-[11.5px] font-semibold text-foreground">Total: {formatarMoeda(total)}</p>}
    </Card>
  );
}
