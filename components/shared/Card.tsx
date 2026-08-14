import { cn } from "@/lib/cn";

/** Contêiner de cartão padrão (bordas/sombra do design system) usado nos painéis dos módulos. */
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-md border border-hairline bg-background shadow-card", className)}>{children}</div>
  );
}

export function StatCard({
  titulo,
  valor,
  subtitulo,
  destaque,
}: {
  titulo: string;
  valor: string | number;
  subtitulo?: string;
  destaque?: boolean;
}) {
  return (
    <Card className={cn("p-4", destaque && "border-brand-primary/40 bg-brand-primary-050")}>
      <p className="text-[11px] font-medium tracking-wide text-foreground-muted uppercase">{titulo}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{valor}</p>
      {subtitulo && <p className="mt-0.5 text-[10.5px] text-foreground-muted">{subtitulo}</p>}
    </Card>
  );
}
