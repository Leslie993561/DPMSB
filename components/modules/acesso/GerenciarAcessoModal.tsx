"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { iniciais } from "@/lib/format";
import type { GestorAcesso } from "@/lib/db/acessoGestores";
import { PermissoesGestorModal } from "./PermissoesGestorModal";

export function GerenciarAcessoModal({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [gestores, setGestores] = useState<GestorAcesso[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [gestorSelecionado, setGestorSelecionado] = useState<GestorAcesso | null>(null);

  async function recarregar() {
    setCarregando(true);
    try {
      const res = await fetch("/api/acesso-gestores");
      const data = await res.json();
      setGestores(data.gestores ?? []);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (aberto) void recarregar();
  }, [aberto]);

  async function adicionarGestor() {
    setErro(null);
    if (!nome.trim() || !email.trim()) {
      setErro("Preencha nome e e-mail corporativo.");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/acesso-gestores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Não foi possível adicionar o gestor.");
        return;
      }
      setNome("");
      setEmail("");
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
                <label className="text-[10.5px] font-semibold text-foreground-muted uppercase">Nome</label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo"
                  className="rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[12.5px] text-foreground"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10.5px] font-semibold text-foreground-muted uppercase">E-mail corporativo</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@msbbrasil.com"
                  className="rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[12.5px] text-foreground"
                />
              </div>
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
