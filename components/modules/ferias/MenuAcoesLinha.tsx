"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface ItemMenuAcao {
  rotulo: string;
  onClick: () => void;
  desabilitado?: boolean;
  titulo?: string;
  perigo?: boolean;
}

const LARGURA = 208;

/**
 * Menu ⋮ da linha de uma tabela. A lista abre com `position: fixed`, ancorada
 * no botão, para ficar POR CIMA da tela: dentro de `absolute` ela era cortada
 * pelo overflow da tabela e só aparecia um pedaço.
 */
export function MenuAcoesLinha({ rotuloAria, itens }: { rotuloAria: string; itens: ItemMenuAcao[] }) {
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!posicao) return;
    const fechar = () => setPosicao(null);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [posicao]);

  function alternar() {
    if (posicao) return setPosicao(null);
    const r = botao.current?.getBoundingClientRect();
    if (!r) return;
    const alturaMenu = itens.length * 34 + 10;
    const cabeAbaixo = r.bottom + 4 + alturaMenu <= window.innerHeight;
    setPosicao({
      top: cabeAbaixo ? r.bottom + 4 : Math.max(8, r.top - 4 - alturaMenu),
      left: Math.max(8, Math.min(r.left, window.innerWidth - LARGURA - 8)),
    });
  }

  return (
    <span className="inline-flex">
      <button
        ref={botao}
        type="button"
        aria-label={rotuloAria}
        aria-expanded={posicao !== null}
        onClick={alternar}
        className="rounded px-1 leading-none text-foreground-muted hover:bg-brand-surface hover:text-foreground"
      >
        <span aria-hidden>⋮</span>
      </button>

      {posicao && (
        <>
          {/* Camada de fechamento: qualquer clique fora recolhe o menu. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setPosicao(null)}
            className="fixed inset-0 z-[90] cursor-default"
          />
          <span
            style={{ top: posicao.top, left: posicao.left, width: LARGURA }}
            className="fixed z-[100] flex flex-col overflow-hidden rounded-md border border-hairline bg-background py-1 shadow-drawer"
          >
            {itens.map((item) => (
              <button
                key={item.rotulo}
                type="button"
                disabled={item.desabilitado}
                title={item.titulo}
                onClick={() => {
                  setPosicao(null);
                  item.onClick();
                }}
                className={cn(
                  "px-3 py-1.5 text-left text-[12px] font-normal normal-case hover:bg-surface-page disabled:cursor-not-allowed disabled:text-foreground-muted/50 disabled:hover:bg-transparent",
                  item.perigo ? "text-red-600 dark:text-red-400" : "text-foreground",
                )}
              >
                {item.rotulo}
              </button>
            ))}
          </span>
        </>
      )}
    </span>
  );
}
