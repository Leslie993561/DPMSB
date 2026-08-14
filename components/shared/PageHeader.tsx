import { cn } from "@/lib/cn";

/** Cabeçalho de página padrão: trilha (eyebrow) + título + subtítulo + ação opcional à direita. */
export function PageHeader({
  eyebrow,
  titulo,
  subtitulo,
  acao,
}: {
  eyebrow: string;
  titulo: string;
  subtitulo?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline bg-background px-4 py-3 shadow-card">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.1em] text-brand-primary-800 uppercase">{eyebrow}</p>
        <h1 className="text-[15px] font-semibold text-foreground">{titulo}</h1>
        {subtitulo && <p className="text-[11.5px] font-light text-foreground-muted">{subtitulo}</p>}
      </div>
      {acao}
    </div>
  );
}

export function BotaoPrimario({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-[12.5px] font-medium text-brand-white shadow-card transition-colors hover:bg-brand-primary-hover",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
