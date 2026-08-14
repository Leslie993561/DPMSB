import type { MemoriaCalculoStep } from "@/lib/calc";
import { formatarMoeda } from "@/lib/format";

export function MemoriaCalculoTable({
  passos,
  titulo = "Memória de cálculo",
}: {
  passos: MemoriaCalculoStep[];
  titulo?: string;
}) {
  if (passos.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-brand-surface dark:border-brand-neutral/30">
      <table className="w-full min-w-[420px] text-sm">
        <caption className="border-b border-brand-surface bg-brand-surface/40 px-4 py-2 text-left font-medium text-foreground dark:border-brand-neutral/30 dark:bg-brand-neutral/10">
          {titulo}
        </caption>
        <tbody>
          {passos.map((passo, i) => (
            <tr key={i} className="border-b border-brand-surface/60 last:border-0 dark:border-brand-neutral/20">
              <td className="px-4 py-2 align-top text-foreground">
                {passo.label}
                {passo.formula && (
                  <div className="mt-0.5 font-mono text-xs text-foreground-muted">
                    {passo.formula}
                  </div>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right font-mono tabular-nums text-foreground">
                {formatarMoeda(passo.valor)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
