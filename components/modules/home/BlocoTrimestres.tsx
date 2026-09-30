"use client";

import Link from "next/link";
import { formatarMoeda } from "@/lib/format";

export interface TrimestreValor {
  trimestre: 1 | 2 | 3 | 4;
  valor: number;
  detalhe?: string;
}

const ROTULO_TRIMESTRE: Record<1 | 2 | 3 | 4, string> = {
  1: "Q1 · jan-fev-mar",
  2: "Q2 · abr-mai-jun",
  3: "Q3 · jul-ago-set",
  4: "Q4 · out-nov-dez",
};

/** Bloco "por trimestre" reaproveitado pelos 3 cartões de resumo da home (DP, SST, DHO). */
export function BlocoTrimestres({ titulo, href, dados }: { titulo: string; href: string; dados: TrimestreValor[] | null }) {
  return (
    <div className="rounded-lg border border-hairline p-3">
      <Link href={href} className="text-[11px] font-bold tracking-wide text-foreground-muted uppercase hover:text-brand-primary-800">
        {titulo}
      </Link>
      <div className="mt-2 flex flex-col divide-y divide-hairline/60">
        {dados === null ? (
          <p className="py-2 text-[11.5px] text-foreground-muted">Carregando...</p>
        ) : dados.length === 0 ? (
          <p className="py-2 text-[11.5px] text-foreground-muted">Sem dados disponíveis.</p>
        ) : (
          dados.map((t) => (
            <div key={t.trimestre} className="flex items-baseline justify-between gap-2 py-1.5">
              <div>
                <p className="text-[12px] font-medium text-foreground">{ROTULO_TRIMESTRE[t.trimestre]}</p>
                {t.detalhe && <p className="text-[10.5px] text-foreground-muted">{t.detalhe}</p>}
              </div>
              <p className="text-[13px] font-semibold text-brand-primary-800">{formatarMoeda(t.valor)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
