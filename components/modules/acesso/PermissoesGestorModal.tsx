"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { MODULOS_PORTAL, type ModuloAcesso } from "@/lib/acesso/modulos";
import type { GestorAcesso } from "@/lib/db/acessoGestores";

function Toggle({ ligado, onClick, titulo }: { ligado: boolean; onClick: () => void; titulo: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-pressed={ligado}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        ligado ? "bg-brand-primary" : "bg-brand-surface"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-brand-white shadow-sm transition-transform ${
          ligado ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function PermissoesGestorModal({
  gestor,
  onFechar,
}: {
  gestor: GestorAcesso | null;
  onFechar: () => void;
}) {
  const [liberados, setLiberados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!gestor) return;
    setCarregando(true);
    setErro(null);
    fetch(`/api/acesso-gestores/${gestor.id}/permissoes`)
      .then((r) => r.json())
      .then((data) => setLiberados(new Set<string>(data.liberados ?? [])))
      .catch(() => setErro("Não foi possível carregar as permissões deste gestor."))
      .finally(() => setCarregando(false));
  }, [gestor]);

  async function persistir(proximo: Set<string>) {
    if (!gestor) return;
    setLiberados(proximo);
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/acesso-gestores/${gestor.id}/permissoes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liberados: [...proximo] }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setErro("Não foi possível salvar — tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  function alternarFolha(chave: string) {
    const proximo = new Set(liberados);
    if (proximo.has(chave)) proximo.delete(chave);
    else proximo.add(chave);
    void persistir(proximo);
  }

  function alternarTodos(modulo: ModuloAcesso) {
    if (!modulo.filhos) return alternarFolha(modulo.chave);
    const chaves = modulo.filhos.map((f) => f.chave);
    const todosLigados = chaves.every((c) => liberados.has(c));
    const proximo = new Set(liberados);
    for (const c of chaves) {
      if (todosLigados) proximo.delete(c);
      else proximo.add(c);
    }
    void persistir(proximo);
  }

  return (
    <Modal
      aberto={Boolean(gestor)}
      onFechar={onFechar}
      eyebrow="Controle de acesso"
      titulo={gestor ? `Permissões de ${gestor.nome}` : ""}
      subtitulo={gestor?.email}
      largura="56rem"
    >
      {carregando ? (
        <p className="py-6 text-center text-[13px] text-foreground-muted">Carregando…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-[12.5px] text-foreground-muted">
            Marque os módulos e submódulos que {gestor?.nome} pode ver no portal. Tudo começa bloqueado.
          </p>
          <p className="rounded-md bg-brand-primary-050 px-3.5 py-2.5 text-[12px] text-brand-primary-800">
            A mudança vale a partir do próximo login — se {gestor?.nome} já estiver com o portal aberto, precisa
            sair e entrar de novo pra ver o efeito.
          </p>
          {erro && <p className="rounded-md bg-status-danger/10 px-3.5 py-2.5 text-[12.5px] text-status-danger">{erro}</p>}

          <div className="grid gap-3 md:grid-cols-2">
            {MODULOS_PORTAL.map((modulo) => {
              const filhos = modulo.filhos ?? [];
              const todosLigados = filhos.length > 0 && filhos.every((f) => liberados.has(f.chave));
              const algumLigado = filhos.some((f) => liberados.has(f.chave));

              return (
                <div key={modulo.chave} className="rounded-md border border-hairline px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 text-[14.5px] font-semibold text-foreground">{modulo.label}</span>
                    {filhos.length > 0 ? (
                      <>
                        {algumLigado && !todosLigados && (
                          <span className="text-[11px] text-foreground-muted">parcial</span>
                        )}
                        <Toggle
                          ligado={todosLigados}
                          onClick={() => alternarTodos(modulo)}
                          titulo="Liberar/bloquear todos os submódulos"
                        />
                      </>
                    ) : (
                      <Toggle
                        ligado={liberados.has(modulo.chave)}
                        onClick={() => alternarFolha(modulo.chave)}
                        titulo={`Liberar/bloquear ${modulo.label}`}
                      />
                    )}
                  </div>

                  {filhos.length > 0 && (
                    <div className="mt-3 ml-1 flex flex-col gap-3 border-l border-hairline pl-4">
                      {filhos.map((filho) => (
                        <div key={filho.chave} className="flex items-center gap-3">
                          <span className="min-w-0 flex-1 text-[13.5px] text-foreground-muted">{filho.label}</span>
                          <Toggle
                            ligado={liberados.has(filho.chave)}
                            onClick={() => alternarFolha(filho.chave)}
                            titulo={`Liberar/bloquear ${filho.label}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[11.5px] text-foreground-muted">{salvando ? "Salvando…" : "Alterações salvas automaticamente."}</p>
        </div>
      )}
    </Modal>
  );
}
