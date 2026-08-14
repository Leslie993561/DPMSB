"use client";

import { useEffect, useState } from "react";

const CHAVE_STORAGE = "portal-dp:operador";

/**
 * Identificação simples do operador para fins de auditoria (quem lançou o
 * quê). Não é autenticação — apenas um nome salvo no navegador, enviado em
 * toda chamada que grava um lançamento de férias.
 *
 * O valor só pode ser lido do localStorage DEPOIS da hidratação (o servidor
 * não tem acesso a ele) — por isso a leitura acontece em um efeito, e não via
 * useSyncExternalStore, que aplicaria o valor real já na primeira renderização
 * do cliente e quebraria a hidratação quando o servidor renderizou "".
 */
export function useOperador() {
  const [operador, setOperadorState] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ver comentário acima
    setOperadorState(localStorage.getItem(CHAVE_STORAGE) ?? "");
  }, []);

  function setOperador(nome: string) {
    setOperadorState(nome);
    localStorage.setItem(CHAVE_STORAGE, nome);
  }

  return { operador, setOperador };
}
