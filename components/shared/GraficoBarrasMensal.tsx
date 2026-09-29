import { cn } from "@/lib/cn";
import { formatarMoeda } from "@/lib/format";

/** Uma série do gráfico (ex.: "Orçado"/"Realizado", ou "EPI"/"Exames") — rótulo da legenda + cor da barra. */
export interface SerieGraficoBarras {
  label: string;
  /** Classe Tailwind de background (ex.: "bg-brand-primary"). */
  cor: string;
}

export interface PontoGraficoBarras {
  mesLabel: string;
  /** Um valor por série, na mesma ordem de `series`. */
  valores: number[];
}

/**
 * Gráfico de barras agrupadas por mês — genérico o bastante pra Orçado×Realizado
 * (EPI, Fardamento, Orçamento do DHO) e Valor×Valor (EPI×Exames), sem repetir o
 * SVG/CSS em cada módulo.
 */
export function GraficoBarrasMensal({
  series,
  dados,
  formatarValor = formatarMoeda,
}: {
  series: SerieGraficoBarras[];
  dados: PontoGraficoBarras[];
  formatarValor?: (valor: number) => string;
}) {
  const max = Math.max(1, ...dados.flatMap((d) => d.valores));
  if (dados.length === 0) {
    return <p className="py-6 text-center text-[12px] text-foreground-muted">Nenhum dado disponível.</p>;
  }
  return (
    <div>
      <div className="flex items-end gap-3 overflow-x-auto pb-1">
        {dados.map((d, i) => (
          <div key={i} className="flex min-w-[44px] flex-1 flex-col items-center gap-1">
            <div className="flex h-24 w-full items-end justify-center gap-1">
              {d.valores.map((v, j) => (
                <div
                  key={j}
                  className={cn("w-3 rounded-t", series[j]?.cor ?? "bg-brand-primary")}
                  style={{ height: `${Math.max(2, Math.round((v / max) * 100))}%` }}
                  title={`${series[j]?.label ?? ""}: ${formatarValor(v)}`}
                />
              ))}
            </div>
            <span className="text-[9.5px] text-foreground-muted">{d.mesLabel}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-4 text-[10.5px] text-foreground-muted">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("h-2.5 w-2.5 rounded-sm", s.cor)} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
