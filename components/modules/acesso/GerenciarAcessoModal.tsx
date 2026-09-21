"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { iniciais } from "@/lib/format";
import type { GestorAcesso } from "@/lib/db/acessoGestores";
import { PermissoesGestorModal } from "./PermissoesGestorModal";

interface ColaboradorCandidato {
  id: number;
  nome: string;
  email: string | null;
  cargo: string | null;
  gestorId: number | null;
}

export function GerenciarAcessoModal({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [gestores, setGestores] = useState<GestorAcesso[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorCandidato[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [colaboradorId, setColaboradorId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [gestorSelecionado, setGestorSelecionado] = useState<GestorAcesso | null>(null);

  async function recarregar() {
    setCarregando(true);
    try {
      const [resGestores, resColaboradores] = await Promise.all([
        fetch("/api/acesso-gestores"),
        fetch("/api/colaboradores"),
      ]);
      const dataGestores = await resGestores.json();
      const dataColaboradores = await resColaboradores.json();
      setGestores(dataGestores.gestores ?? []);
      setColaboradores(dataColaboradores.colaboradores ?? []);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (aberto) void recarregar();
  }, [aberto]);

  // Só quem já é gestor_id de alguém no cadastro — mesma regra que a API
  // valida no servidor — e que ainda não está na lista de acesso.
  const candidatos = useMemo(() => {
    const idsGestores = new Set(colaboradores.map((c) => c.gestorId).filter((id): id is number => id !== null));
    const emailsJaCadastrados = new Set(gestores.map((g) => g.email.toLowerCase()));
    return colaboradores
      .filter((c) => idsGestores.has(c.id) && c.email && !emailsJaCadastrados.has(c.email.toLowerCase()))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [colaboradores, gestores]);

  const candidatoSelecionado = candidatos.find((c) => String(c.id) === colaboradorId);

  async function adicionarGestor() {
    setErro(null);
    if (!candidatoSelecionado) {
      setErro("Selecione um gestor na lista.");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/acesso-gestores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: candidatoSelecionado.nome, email: candidatoSelecionado.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Não foi possível adicionar o gestor.");
        return;
      }
      setColaboradorId("");
      setFormAberto(false);
      await recarregar();
    } finally {
      setSalvando(false);
    }
  }

  async function alternarStatus(gestor: GestorAcesso) {
    const proximo = gestor.status === "ativo" ? "inativo" : "ativo";
    await fetch(`/api/acesso-gestores/${gestor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: proximo }),
    });
    await recarregar();
  }

  return (
    <>
      <Modal
        aberto={aberto}
        onFechar={onFechar}
        eyebrow="Meu perfil"
        titulo="Gerenciar acesso"
        subtitulo="Gestores autorizados a acessar o Portal DP pelo e-mail corporativo"
        largura="32rem"
      >
        <div className="flex flex-col gap-3">
          {!formAberto ? (
            <button
              type="button"
              onClick={() => setFormAberto(true)}
              className="self-start rounded-md bg-brand-primary px-3 py-1.5 text-[12.5px] font-semibold text-brand-white transition-colors hover:bg-brand-primary-800"
            >
              + Adicionar gestor
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-md border border-hairline bg-surface-page p-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10.5px] font-semibold text-foreground-muted uppercase">Gestor</label>
                {candidatos.length === 0 ? (
                  <p className="text-[11.5px] text-foreground-muted">
                    Nenhum colaborador do cadastro é gestor de alguém ainda (ou todos já estão nesta lista).
                  </p>
                ) : (
                  <select
                    value={colaboradorId}
                    onChange={(e) => setColaboradorId(e.target.value)}
                    className="rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[12.5px] text-foreground"
                  >
                    <option value="">Selecione…</option>
                    {candidatos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                        {c.cargo ? ` — ${c.cargo}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {candidatoSelecionado && (
                <p className="text-[11px] text-foreground-muted">{candidatoSelecionado.email}</p>
              )}
              {erro && <p className="text-[11.5px] text-status-danger">{erro}</p>}
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => void adicionarGestor()}
                  className="rounded-md bg-brand-primary px-3 py-1.5 text-[12.5px] font-semibold text-brand-white transition-colors hover:bg-brand-primary-800 disabled:opacity-60"
                >
                  {salvando ? "Salvando…" : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormAberto(false);
                    setErro(null);
                    setColaboradorId("");
                  }}
                  className="rounded-md px-3 py-1.5 text-[12.5px] font-semibold text-foreground-muted transition-colors hover:bg-surface-page"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col divide-y divide-hairline rounded-md border border-hairline">
            {carregando && <p className="px-3 py-4 text-center text-[12px] text-foreground-muted">Carregando…</p>}
            {!carregando && gestores.length === 0 && (
              <p className="px-3 py-4 text-center text-[12px] text-foreground-muted">Nenhum gestor cadastrado ainda.</p>
            )}
            {gestores.map((gestor) => (
              <div key={gestor.id} className="flex items-center gap-2.5 px-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-primary text-[11px] font-bold text-brand-white">
                  {iniciais(gestor.nome)}
                </span>
                <button
                  type="button"
                  onClick={() => setGestorSelecionado(gestor)}
                  title="Ver permissões de acesso"
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-[12.5px] font-semibold text-brand-primary-800 hover:underline">
                    {gestor.nome}
                  </span>
                  <span className="block truncate text-[11px] text-foreground-muted">{gestor.email}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void alternarStatus(gestor)}
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                    gestor.status === "ativo"
                      ? "bg-status-success/15 text-status-success"
                      : "bg-brand-surface text-foreground-muted"
                  }`}
                  title="Clique para alternar ativo/inativo"
                >
                  {gestor.status === "ativo" ? "Ativo" : "Inativo"}
                </button>
              </div>
            ))}
          </div>

          <p className="text-[10.5px] text-foreground-muted">
            Só colaboradores que já são gestor de alguém no cadastro podem ser adicionados aqui. Ao cadastrar, nenhum
            módulo vem liberado — clique no nome do gestor para escolher o que ele pode ver.
          </p>
        </div>
      </Modal>

      <PermissoesGestorModal gestor={gestorSelecionado} onFechar={() => setGestorSelecionado(null)} />
    </>
  );
}
