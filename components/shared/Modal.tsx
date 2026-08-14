"use client";

/** Modal centralizado (overlay + card) para fluxos que precisam de foco total — histórico, cálculo, confirmação. */
export function Modal({
  aberto,
  onFechar,
  titulo,
  subtitulo,
  eyebrow,
  children,
  rodape,
  largura = "40rem",
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  subtitulo?: string;
  eyebrow?: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  largura?: string;
}) {
  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark-900/40 p-4"
      onClick={onFechar}
    >
      <div
        className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl bg-background shadow-drawer"
        style={{ maxWidth: largura }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 overflow-hidden bg-brand-dark-900 px-6 py-5">
          <svg
            viewBox="0 0 400 70"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
            fill="none"
            stroke="var(--brand-accent)"
            strokeWidth={1.5}
          >
            <path d="M-20 50C80 10 180 90 280 40S480 -10 620 40" />
          </svg>
          <div className="relative flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <div className="text-[9.5px] font-semibold tracking-[0.14em] text-brand-accent">
                  {eyebrow.toUpperCase()}
                </div>
              )}
              <div className="mt-1 truncate text-[17px] font-bold text-brand-white">{titulo}</div>
              {subtitulo && <div className="mt-0.5 text-[11px] text-brand-surface">{subtitulo}</div>}
            </div>
            <button
              type="button"
              onClick={onFechar}
              title="Fechar"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-white transition-colors hover:bg-white/20"
            >
              <span aria-hidden className="text-sm leading-none">
                ✕
              </span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {rodape && (
          <div className="flex shrink-0 items-center gap-2 border-t border-hairline bg-surface-page px-6 py-3.5">
            {rodape}
          </div>
        )}
      </div>
    </div>
  );
}
