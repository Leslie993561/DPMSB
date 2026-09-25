"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/shared/Card";
import { formatarMoeda } from "@/lib/format";
import type { ResumoKit } from "@/lib/db/dho";

export function EstoqueKitsClient({ kitsIniciais }: { kitsIniciais: ResumoKit[] }) {
  const [kits, setKits] = useState(kitsIniciais);
  const [menuAberto, setMenuAberto] = useState<number | null>(null);
  const [enviarKit, setEnviarKit] = useState<ResumoKit | null>(null);

  async function recarregar() {
    const res = await fetch("/api/dho/kits");
    const dados = await res.json();
    setKits(dados.kits ?? []);
  }

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-left text-[12.5px]">
        <thead className="border-b border-hairline bg-surface-page text-[10.5px] font-semibold tracking-wide text-foreground-muted uppercase">
          <tr>
            <th className="px-4 py-2.5">Kit</th>
            <th className="px-4 py-2.5">Valor</th>
            <th className="px-4 py-2.5">Quantidade em estoque</th>
            <th className="w-10 px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {kits.map((kit) => (
            <tr key={kit.id}>
              <td className="px-4 py-2.5">
                <Link href={`/dho/endomarketing/kits/${kit.id}`} className="font-medium text-brand-primary hover:text-brand-primary-hover">
                  {kit.nome}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-foreground">{formatarMoeda(kit.valor)}</td>
              <td className="px-4 py-2.5 text-foreground">{kit.quantidadeEstoque}</td>
              <td className="relative px-4 py-2.5 text-right">
                <button
                  type="button"
                  onClick={() => setMenuAberto(menuAberto === kit.id ? null : kit.id)}
                  className="rounded px-1.5 py-0.5 text-foreground-muted hover:bg-surface-page"
                  title="Mais ações"
                >
                  ⋮
                </button>
                {menuAberto === kit.id && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setMenuAberto(null)} />
                    <div className="absolute top-full right-4 z-30 mt-1 w-52 rounded-md border border-hairline bg-background py-1 text-left shadow-drawer">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuAberto(null);
                          setEnviarKit(kit);
                        }}
                        className="block w-full px-3 py-1.5 text-left text-[12px] text-foreground hover:bg-surface-page"
                      >
                        Direcionar kit completo
                      </button>
                    </div>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {enviarKit && (
        <ModalDirecionarKitCompleto
          kit={enviarKit}
          onFechar={() => setEnviarKit(null)}
          onEnviado={() => {
            setEnviarKit(null);
            void recarregar();
          }}
        />
      )}
    </Card>
  );
}

interface ColaboradorOpcao {
  id: number;
  nome: string;
}

function ModalDirecionarKitCompleto({
  kit,
  onFechar,
  onEnviado,
}: {
  kit: ResumoKit;
  onFechar: () => void;
  onEnviado: () => void;
}) {
  const [colaboradores, setColaboradores] = useState<ColaboradorOpcao[]>([]);
  const [colaboradorId, setColaboradorId] = useState("");
  const [materiaisIds, setMateriaisIds] = useState<number[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/colaboradores")
      .then((r) => r.json())
      .then((d) => setColaboradores((d.colaboradores ?? []).map((c: ColaboradorOpcao) => ({ id: c.id, nome: c.nome }))));
    fetch(`/api/dho/kits/${kit.id}`)
      .then((r) => r.json())
      .then((d) => setMateriaisIds((d.kit?.materiais ?? []).map((m: { id: number }) => m.id)));
  }, [kit.id]);

  async function enviar() {
    if (!colaboradorId) {
      setErro("Selecione o colaborador.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/dho/kits/${kit.id}/enviar`, {
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
        <p className="text-[14px] font-semibold text-foreground">Direcionar {kit.nome}</p>
        <p className="mt-0.5 text-[11.5px] text-foreground-muted">Envia todos os materiais do kit ao colaborador escolhido.</p>

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
