"use client";

import { useEffect, useState } from "react";

export type TipoSessaoCliente = "administrador" | "gestor";

export interface SessaoResumo {
  tipo: TipoSessaoCliente;
  nome: string;
  cargo: string | null;
}

/**
 * Resumo da sessão logada, para telas cliente decidirem o que mostrar (botão
 * de editar, ações de RH etc.) — vem de GET /api/auth/sessao, que só expõe
 * tipo/nome/cargo (nunca `liberados` ou `colaboradorId`). `null` enquanto
 * carrega ou se a sessão não existir.
 */
export function useSessaoResumo(): SessaoResumo | null {
  const [sessao, setSessao] = useState<SessaoResumo | null>(null);

  useEffect(() => {
    fetch("/api/auth/sessao")
      .then((r) => r.json())
      .then((d: { tipo: TipoSessaoCliente | null; nome?: string; cargo?: string | null }) => {
        if (d.tipo) setSessao({ tipo: d.tipo, nome: d.nome ?? "", cargo: d.cargo ?? null });
      })
      .catch(() => {});
  }, []);

  return sessao;
}
