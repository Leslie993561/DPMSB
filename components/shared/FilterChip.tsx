import { cn } from "@/lib/cn";

/** Pílula de filtro (ex.: setor/departamento) com estado ativo/inativo. */
export function FilterChip({
  ativo,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { ativo?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors",
        ativo
          ? "border-brand-primary/50 bg-brand-primary-100 text-brand-primary-800"
          : "border-hairline bg-background text-foreground hover:border-brand-primary hover:bg-brand-primary-050 hover:text-brand-primary-800",
      )}
      {...props}
    >
      {children}
    </button>
  );
}
