import { cn } from "@/lib/cn";

export type CorBadge = "neutro" | "azul" | "verde" | "amarelo" | "vermelho";

/** Mapeado 1:1 ao esquema semântico N/B/G/A/R do protótipo de design (situação de períodos/lançamentos). */
const CORES: Record<CorBadge, string> = {
  neutro: "bg-brand-surface text-foreground-muted",
  azul: "bg-status-emcurso-bg text-status-emcurso", // B — em curso / fracionada / em aberto
  verde: "bg-status-success-bg text-status-success", // G — gozada / concluída
  amarelo: "bg-status-warning-bg text-status-warning", // A — a vencer / pendente
  vermelho: "bg-status-danger-bg text-status-danger", // R — vencida / dobra
};

export function Badge({ cor = "neutro", children }: { cor?: CorBadge; children: React.ReactNode }) {
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap", CORES[cor])}>
      {children}
    </span>
  );
}
