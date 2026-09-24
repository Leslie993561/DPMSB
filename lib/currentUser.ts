"use client";

import { useSessaoResumo } from "./authClient";

/**
 * Identificação do operador para fins de auditoria (quem lançou o quê),
 * enviada em toda chamada que grava um lançamento de férias.
 *
 * Vem da SESSÃO logada (GET /api/auth/sessao) — antes era um campo de texto
 * livre que a própria pessoa preenchia (guardado no localStorage), o que não
 * fazia sentido: quem lança já está autenticado com o próprio perfil, não
 * precisa digitar quem é. `setOperador` continua existindo só para não
 * quebrar quem já chamava — não faz mais nada, o nome não é mais editável.
 */
export function useOperador() {
  const sessao = useSessaoResumo();
  function setOperador(_nome: string) {}
  return { operador: sessao?.nome ?? "", setOperador };
}
