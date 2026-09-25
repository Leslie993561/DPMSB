"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/shared/Card";
import { formatarMoeda, formatarDataBr } from "@/lib/format";
import type { DetalheKit } from "@/lib/db/dho";

interface ColaboradorOpcao {
  id: number;
  nome: string;
}

export function KitDetalheClient({ kitInicial }: { kitInicial: DetalheKit }) {
  const [kit, setKit] = useState(kitInicial);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [enviarAberto, setEnviarAberto] = useState(false);

  async function recarregar() {
    const res = await fetch(`/api/dho/kits/${kit.id}`);
    const dados = await res.json();
    if (dados.kit) setKit(dados.kit);
  }

  async function salvarMaterial(materialId: number, valor: number, quantidadeEstoque: number) {
    setKit((atual) => ({
      ...atual,
      materiais: atual.materiais.map((m) => (m.id === materialId ? { ...m, valor, quantidadeEstoque } : m)),
    }));
    await fetch(`/api/dho/kits/${kit.id}/materiais/${materialId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor, quantidadeEstoque }),
    });
  }

  function alternarSelecao(materialId: number) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(materialId)) novo.delete(materialId);
      else novo.add(materialId);
      return novo;
    });
  }

  const todosSelecionados = kit.materiais.length > 0 && selecionados.size === kit.materiais.length;

  return (
    <div className="space-y-4">
      <Link href="/dho/endomarketing/kits" className="text-[12px] text-brand-primary hover:text-brand-primary-hover">
        ‹ Voltar para Estoque de Kits
      </Link>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-[12.5px]">
          <thead className="border-b border-hairline bg-surface-page text-[10.5px] font-semibold tracking-wide text-foreground-muted uppercase">
            <tr>
              <th className="px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={todosSelecionados}
                  onChange={() => setSelecionados(todosSelecionados ? new Set() : new Set(kit.materiais.map((m) => m.id)))}
                />
              </th>
              <th className="px-4 py-2.5">Material</th>
              <th className="px-4 py-2.5">Valor</th>
              <th className="px-4 py-2.5">Quantidade em estoque</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {kit.materiais.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2">
                  <input type="checkbox" checked={selecionados.has(m.id)} onChange={() => alternarSelecao(m.id)} />
                </td>
                <td className="px-4 py-2 text-foreground">{m.nome}</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={m.valor}
                    onBlur={(e) => salvarMaterial(m.id, Number(e.target.value) || 0, m.quantidadeEstoque)}
                    className="w-24 rounded border border-hairline bg-background px-2 py-1 text-[12.5px] text-foreground"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min={0}
                    defaultValue={m.quantidadeEstoque}
                    onBlur={(e) => salvarMaterial(m.id, m.valor, Number(e.target.value) || 0)}
                    className="w-20 rounded border border-hairline bg-background px-2 py-1 text-[12.5px] text-foreground"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between gap-2 border-t border-hairline bg-surface-page px-4 py-3">
          <p className="text-[11px] text-foreground-muted">
            {selecionados.size === 0
              ? "Selecione um ou mais materiais para direcionar"
              : `${selecionados.size} material(is) selecionado(s)`}
          </p>
          <button
            type="button"
            disabled={selecionados.size === 0}
            onClick={() => setEnviarAberto(true)}
            className="rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            Direcionar ao colaborador
          </button>
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-[11px] font-bold tracking-wide text-foreground-muted uppercase">Histórico de entregas</p>
        <div className="mt-2 space-y-1.5">
          {kit.historico.length === 0 ? (
            <p className="text-[12px] text-foreground-muted">Nenhuma entrega registrada ainda.</p>
          ) : (
            kit.historico.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-2 rounded border border-hairline px-3 py-2">
                <div>
                  <p className="text-[12.5px] font-medium text-foreground">{h.colaboradorNome}</p>
                  <p className="text-[10.5px] text-foreground-muted">{h.materiais.join(", ")}</p>
                </div>
                <div className="text-right text-[10.5px] text-foreground-muted">
                  <p>{formatarDataBr(h.criadoEm.slice(0, 10))}</p>
                  <p>{h.responsavel}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {enviarAberto && (
        <ModalDirecionar
          kitId={kit.id}
          materiaisIds={[...selecionados]}
          onFechar={() => setEnviarAberto(false)}
          onEnviado={() => {
            setEnviarAberto(false);
            setSelecionados(new Set());
            void recarregar();
          }}
        />
      )}
    </div>
  );
}

function ModalDirecionar({
  kitId,
  materiaisIds,
  onFechar,
  onEnviado,
}: {
  kitId: number;
  materiaisIds: number[];
  onFechar: () => void;
  onEnviado: () => void;
}) {
  const [colaboradores, setColaboradores] = useState<ColaboradorOpcao[]>([]);
  const [colaboradorId, setColaboradorId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/colaboradores")
      .then((r) => r.json())
      .then((d) => setColaboradores((d.colaboradores ?? []).map((c: ColaboradorOpcao) => ({ id: c.id, nome: c.nome }))));
  }, []);

  async function enviar() {
    if (!colaboradorId) {
      setErro("Selecione o colaborador.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/dho/kits/${kitId}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colaboradorId: Number(colaboradorId), materiaisIds }),
      });
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.erro ?? "Falha ao registrar entrega.");
      onEnviado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao registrar entrega.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark-900/40 p-4" onClick={onFechar}>
      <div className="w-full max-w-sm rounded-xl bg-background p-5 shadow-drawer" onClick={(e) => e.stopPropagation()}>
        <p className="text-[14px] font-semibold text-foreground">Direcionar ao colaborador</p>
        <p className="mt-0.5 text-[11.5px] text-foreground-muted">{materiaisIds.length} material(is) selecionado(s)</p>

        {erro && <p className="mt-2 text-[12px] text-status-danger">{erro}</p>}

        <label className="mt-3 block text-[11px] font-medium text-foreground-muted">
          Colaborador
          <select
            value={colaboradorId}
            onChange={(e) => setColaboradorId(e.target.value)}
            className="mt-1 w-full rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[13px] font-normal text-foreground"
          >
            <option value="">Selecione…</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="flex-1 rounded border border-hairline px-3 py-1.5 text-[12.5px] font-medium text-foreground-muted hover:bg-surface-page"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={enviar}
            className="flex-1 rounded bg-brand-primary px-3 py-1.5 text-[12.5px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {salvando ? "Enviando..." : "Direcionar"}
          </button>
        </div>
      </div>
    </div>
  );
}
