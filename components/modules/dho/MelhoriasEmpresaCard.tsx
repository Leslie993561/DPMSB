"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/shared/Card";
import { formatarDataBr, formatarMoeda } from "@/lib/format";
import type { MelhoriaEmpresa } from "@/lib/db/dho";

const INPUT_CLASS =
  "w-full rounded border border-hairline bg-background px-2 py-1.5 text-[12px] text-foreground placeholder:text-foreground-muted/60";

interface LinhaForm {
  chave: number;
  data: string;
  titulo: string;
  quantidade: string;
  valorUnitario: string;
}

let proximaChave = 1;
const novaLinha = (data = ""): LinhaForm => ({ chave: proximaChave++, data, titulo: "", quantidade: "1", valorUnitario: "" });

const totalLinha = (l: LinhaForm) => (Number(l.quantidade) || 0) * (Number(l.valorUnitario) || 0);

/** Orçamento à parte: melhorias comuns à empresa (sem ação de endomarketing) — data, item, quantidade e valor. */
export function MelhoriasEmpresaCard({ ano, onAlterado }: { ano: number; onAlterado?: () => void }) {
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
    setLinhas([
      {
        chave: proximaChave++,
        data: m.data,
        titulo: m.titulo,
        quantidade: String(m.quantidade),
        valorUnitario: String(m.quantidade > 0 ? Math.round((m.valorTotal / m.quantidade) * 100) / 100 : m.valorTotal),
      },
    ]);
    setErro(null);
  }

  function mudar(chave: number, campo: keyof Omit<LinhaForm, "chave">, valor: string) {
    setErro(null);
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)));
  }

  const paraCorpo = (l: LinhaForm) => ({
    data: l.data,
    titulo: l.titulo,
    quantidade: Math.max(1, Math.round(Number(l.quantidade)) || 1),
    valorTotal: Math.round(totalLinha(l) * 100) / 100,
  });
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
      onAlterado?.();
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: number) {
    await fetch(`/api/dho/melhorias/${id}`, { method: "DELETE" });
    if (editandoId === id) limpar();
    await carregar();
    onAlterado?.();
  }

  const total = itens.reduce((soma, m) => soma + m.valorTotal, 0);
  const totalForm = linhas.reduce((soma, l) => soma + totalLinha(l), 0);

  return (
    <Card className="h-full p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-bold tracking-wide text-foreground-muted uppercase">
          {editandoId ? "Editar melhoria" : "Melhorias para a empresa"} · {ano}
        </p>
        {editandoId && (
          <button type="button" onClick={limpar} className="text-[11px] text-brand-primary hover:text-brand-primary-hover">
            Cancelar edição
          </button>
        )}
      </div>
      <p className="mb-2 text-[10.5px] text-foreground-muted">Itens comuns a todos, sem ação de endomarketing.</p>

      <div className="rounded border border-hairline p-2">
        <div className="mb-1 grid grid-cols-[104px_1fr_46px_72px_64px_16px] items-center gap-1.5 text-[10px] font-semibold text-foreground-muted uppercase">
          <span>Data</span>
          <span>Item</span>
          <span>Qtd</span>
          <span>Val. unid.</span>
          <span>Total</span>
          <span />
        </div>
        <div className="space-y-1.5">
          {linhas.map((l, idx) => (
            <div key={l.chave} className="grid grid-cols-[104px_1fr_46px_72px_64px_16px] items-center gap-1.5">
              <input
                type="date"
                value={l.data}
                onChange={(e) => mudar(l.chave, "data", e.target.value)}
                className={INPUT_CLASS}
                aria-label="Data"
              />
              <input
                value={l.titulo}
                onChange={(e) => mudar(l.chave, "titulo", e.target.value)}
                placeholder="Nome"
                className={INPUT_CLASS}
                aria-label="Item"
              />
              <input
                type="number"
                min={1}
                step={1}
                value={l.quantidade}
                onChange={(e) => mudar(l.chave, "quantidade", e.target.value)}
                className={INPUT_CLASS}
                aria-label="Quantidade"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={l.valorUnitario}
                onChange={(e) => mudar(l.chave, "valorUnitario", e.target.value)}
                className={INPUT_CLASS}
                aria-label="Valor unitário"
              />
              <span className="text-[11px] text-brand-primary">{formatarMoeda(totalLinha(l))}</span>
              {linhas.length > 1 && !editandoId ? (
                <button
                  type="button"
                  title="Remover item"
                  onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                  className="text-[12px] text-status-danger hover:opacity-70"
                  aria-label={`Remover item ${idx + 1}`}
                >
                  ✕
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>

        {!editandoId && (
          <button
            type="button"
            onClick={() => setLinhas((ls) => [...ls, novaLinha(ls[ls.length - 1]?.data ?? "")])}
            className="mt-1.5 text-[11.5px] font-medium text-brand-primary hover:text-brand-primary-hover"
          >
            + Adicionar item
          </button>
        )}
        <p className="mt-1 text-right text-[11px] text-foreground-muted">Subtotal: {formatarMoeda(totalForm)}</p>
      </div>

      {erro && <p className="mt-2 text-[11px] text-status-danger">{erro}</p>}
      <button
        type="button"
        disabled={salvando || !linhas.every(linhaCompleta)}
        onClick={salvar}
        className="mt-3 w-full rounded bg-brand-primary px-3 py-2 text-[12.5px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
      >
        {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Adicionar"}
      </button>

      <p className="mt-4 mb-1.5 text-[11px] font-bold tracking-wide text-foreground-muted uppercase">Adicionados em {ano}</p>
      <div className="max-h-56 space-y-1.5 overflow-y-auto">
        {itens.length === 0 ? (
          <p className="text-[12px] text-foreground-muted">Nenhuma melhoria cadastrada em {ano}.</p>
        ) : (
          itens.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded border border-hairline px-2.5 py-1">
              <span className="shrink-0 text-[10.5px] font-semibold text-brand-primary-800">{formatarDataBr(m.data)}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-foreground" title={m.titulo}>
                {m.titulo}
              </span>
              <span className="shrink-0 text-[10.5px] whitespace-nowrap text-foreground-muted">
                Qtd. {m.quantidade} · {formatarMoeda(m.valorTotal)}
              </span>
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
