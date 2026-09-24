"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import type { ItemFicha } from "@/lib/sst/fichas";

const INPUT =
  "rounded border border-hairline bg-background px-2 py-1 text-[11.5px] text-foreground outline-none focus:border-brand-primary";

function brParaIso(dataBr: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataBr.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

function hojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface LinhaEditavel {
  categoria: "epi" | "fardamento";
  nome: string;
  qtd: string;
  ca: string;
  dataEntrega: string;
  dataTroca: string;
}

/**
 * Editar os itens de uma ficha que ainda está aguardando assinatura —
 * aberta clicando na data do histórico. Depois de assinada o comprovante já
 * referencia os itens de então, então nem chega a abrir (a própria API
 * recusa).
 */
export function EditarFichaModal({
  fichaId,
  colaboradorNome,
  onFechar,
  onSalvo,
}: {
  fichaId: string;
  colaboradorNome: string;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [linhas, setLinhas] = useState<LinhaEditavel[] | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [novaCategoria, setNovaCategoria] = useState<"epi" | "fardamento">("epi");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sst/epi/fichas/${fichaId}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.erro ?? "Não foi possível carregar a ficha.");
        const itens: ItemFicha[] = d.documento.itens;
        setLinhas(
          itens.map((i) => ({
            categoria: i.categoria,
            nome: i.epi,
            qtd: String(i.qtd),
            ca: i.ca,
            dataEntrega: brParaIso(i.dataEntrega) || hojeIso(),
            dataTroca: brParaIso(i.dataTroca),
          })),
        );
      })
      .catch((e: Error) => setErroCarga(e.message));
  }, [fichaId]);

  function alterar(idx: number, parcial: Partial<LinhaEditavel>) {
    setLinhas((ls) => (ls ? ls.map((l, i) => (i === idx ? { ...l, ...parcial } : l)) : ls));
  }

  function remover(idx: number) {
    setLinhas((ls) => (ls ? ls.filter((_, i) => i !== idx) : ls));
  }

  function adicionar() {
    const nome = novoNome.trim();
    if (!nome) return;
    setLinhas((ls) => [
      ...(ls ?? []),
      { categoria: novaCategoria, nome, qtd: "1", ca: "", dataEntrega: hojeIso(), dataTroca: "" },
    ]);
    setNovoNome("");
  }

  async function salvar() {
    if (!linhas || linhas.length === 0) {
      setErro("A ficha precisa de ao menos um item.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/sst/epi/fichas/${fichaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itens: linhas
            .filter((l) => l.categoria === "epi")
            .map((l) => ({
              epi: l.nome,
              qtd: Math.max(1, Number(l.qtd) || 1),
              ca: l.ca,
              dataEntrega: l.dataEntrega || hojeIso(),
              dataTroca: l.dataTroca || null,
            })),
          fardamento: linhas
            .filter((l) => l.categoria === "fardamento")
            .map((l) => ({ tipo: l.nome, qtd: Math.max(1, Number(l.qtd) || 1), dataEntrega: l.dataEntrega || hojeIso() })),
        }),
      });
      if (!r.ok) throw new Error((await r.json()).erro ?? "Falha ao salvar.");
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      eyebrow="Gestão de EPI"
      titulo="Editar ficha (aguardando assinatura)"
      subtitulo={colaboradorNome}
      largura="40rem"
      rodape={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="rounded border border-hairline px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-surface-page"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando || !linhas}
            className="rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      }
    >
      {erroCarga ? (
        <p className="text-[12.5px] text-status-danger">{erroCarga}</p>
      ) : linhas === null ? (
        <p className="text-[12.5px] text-foreground-muted">Carregando...</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col divide-y divide-hairline/70 rounded-md border border-hairline">
            {linhas.map((l, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-2.5 py-2">
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground">
                  {l.nome}
                  <span className="ml-1.5 text-[10px] font-normal text-foreground-muted">
                    {l.categoria === "epi" ? "EPI" : "Fardamento"}
                  </span>
                </span>
                <label className="flex flex-col text-[9.5px] text-foreground-muted">
                  Quant.
                  <input
                    type="number"
                    min={1}
                    value={l.qtd}
                    onChange={(e) => alterar(idx, { qtd: e.target.value })}
                    className={INPUT + " w-14"}
                  />
                </label>
                {l.categoria === "epi" && (
                  <label className="flex flex-col text-[9.5px] text-foreground-muted">
                    C.A.
                    <input value={l.ca} onChange={(e) => alterar(idx, { ca: e.target.value })} className={INPUT + " w-20"} />
                  </label>
                )}
                <label className="flex flex-col text-[9.5px] text-foreground-muted">
                  Entrega
                  <input
                    type="date"
                    value={l.dataEntrega}
                    onChange={(e) => alterar(idx, { dataEntrega: e.target.value })}
                    className={INPUT}
                  />
                </label>
                {l.categoria === "epi" && (
                  <label className="flex flex-col text-[9.5px] text-foreground-muted">
                    Troca prevista
                    <input
                      type="date"
                      value={l.dataTroca}
                      onChange={(e) => alterar(idx, { dataTroca: e.target.value })}
                      className={INPUT}
                    />
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => remover(idx)}
                  aria-label={`Remover ${l.nome}`}
                  className="rounded px-1 py-0.5 text-[11px] text-foreground-muted hover:bg-status-danger-bg hover:text-status-danger"
                >
                  ✕
                </button>
              </div>
            ))}
            {linhas.length === 0 && <p className="px-2.5 py-2 text-[11.5px] text-foreground-muted">Nenhum item na ficha.</p>}
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={novaCategoria}
              onChange={(e) => setNovaCategoria(e.target.value as "epi" | "fardamento")}
              className={INPUT}
            >
              <option value="epi">EPI</option>
              <option value="fardamento">Fardamento</option>
            </select>
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionar();
                }
              }}
              placeholder="Nome do item"
              className={INPUT + " min-w-0 flex-1"}
            />
            <button
              type="button"
              onClick={adicionar}
              className="shrink-0 rounded border border-hairline px-2.5 py-1.5 text-[11.5px] font-medium text-brand-primary-800 hover:bg-brand-primary-050"
            >
              Adicionar
            </button>
          </div>

          {erro && <p className="text-[11.5px] text-status-danger">{erro}</p>}
        </div>
      )}
    </Modal>
  );
}
