"use client";

/** Painel lateral (flyout) usado para criar/editar registros sem sair da página. */
export function Drawer({
  aberto,
  onFechar,
  titulo,
  subtitulo,
  eyebrow,
  icone,
  children,
  rodape,
  largura = "26rem",
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  subtitulo?: string;
  eyebrow?: string;
  icone?: React.ReactNode;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  largura?: string;
}) {
  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-brand-dark-900/40" onClick={onFechar}>
      <div
        className="flex h-full flex-col overflow-y-auto bg-background shadow-drawer"
        style={{ width: largura }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-hairline bg-background px-4 py-2.5">
          {icone && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-primary-100 text-brand-primary-800">
              {icone}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <div className="text-[9px] font-semibold tracking-[0.12em] text-brand-primary-800 uppercase">
                {eyebrow}
              </div>
            )}
            <div className="truncate text-[13px] font-semibold text-foreground">{titulo}</div>
            {subtitulo && <div className="truncate text-[10.5px] text-foreground-muted">{subtitulo}</div>}
          </div>
          <button
            type="button"
            onClick={onFechar}
            title="Fechar"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-foreground-muted transition-colors hover:bg-surface-page hover:text-foreground"
          >
            <span aria-hidden className="text-sm leading-none">
              ✕
            </span>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-2 px-4 py-2.5">{children}</div>

        {rodape && (
          <div className="mt-auto flex items-center gap-2 border-t border-hairline bg-surface-page px-4 py-2.5">
            {rodape}
          </div>
        )}
      </div>
    </div>
  );
}
