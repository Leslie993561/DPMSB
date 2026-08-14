import { cn } from "@/lib/cn";

export type NivelRisco = "info" | "atencao" | "critico" | "sucesso";

const estilos: Record<NivelRisco, string> = {
  info: "border-hairline bg-brand-primary-050 text-[#51606b]",
  atencao: "border-status-warning-border bg-status-warning-bg text-status-warning",
  critico: "border-status-danger-border bg-status-danger-bg text-status-danger",
  sucesso: "border-status-success/30 bg-status-success-bg text-status-success",
};

const icones: Record<NivelRisco, string> = { info: "🔵", atencao: "🟡", critico: "🔴", sucesso: "🟢" };

export function RiskCallout({ nivel = "atencao", children }: { nivel?: NivelRisco; children: React.ReactNode }) {
  return (
    <div className={cn("flex gap-2 rounded-lg border px-4 py-3 text-sm", estilos[nivel])}>
      <span aria-hidden>{icones[nivel]}</span>
      <div>{children}</div>
    </div>
  );
}
