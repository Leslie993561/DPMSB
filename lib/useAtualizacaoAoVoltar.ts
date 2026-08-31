"use client";

import { useEffect } from "react";

/**
 * Recarrega quando a tela volta a ser vista.
 *
 * As abas de Benefícios são a mesma página: quem importa uma planilha no
 * Rateio e volta ao Dashboard esperava o número novo, e via o de antes — o
 * componente remonta, mas a resposta vinha do cache HTTP do navegador, e
 * mesmo sem isso uma aba aberta em outra janela envelhece sozinha.
 *
 * Dispara ao focar a janela e ao a aba do navegador voltar a ficar visível.
 * Não faz polling: recarregar de tempos em tempos gastaria conexão do pool
 * (que já é escasso) para uma tela que ninguém está olhando.
 */
export function useAtualizacaoAoVoltar(recarregar: () => void | Promise<void>): void {
  useEffect(() => {
    // Focar a janela já significa que alguém está olhando; não se exige
    // visibilidade aí. Em visibilitychange, sim: só interessa quando a aba
    // VOLTA a aparecer, não quando ela some.
    const aoFocar = () => void recarregar();
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "visible") void recarregar();
    };
    window.addEventListener("focus", aoFocar);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      window.removeEventListener("focus", aoFocar);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, [recarregar]);
}

/** `fetch` que nunca serve resposta do cache — para dado que muda a cada edição. */
export function buscarSemCache(url: string): Promise<Response> {
  return fetch(url, { cache: "no-store" });
}
