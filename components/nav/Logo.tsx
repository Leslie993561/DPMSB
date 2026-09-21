/**
 * Logotipo oficial MSB, extraído do arquivo de design do Portal DP.
 *
 * `<img>` puro de propósito, não `next/image`: o otimizador (`/_next/image`)
 * às vezes falha buscando o próprio arquivo internamente ("resource isn't a
 * valid image", corpo `null`) e derruba a logo em toda página. Arquivo já é
 * um PNG pequeno (23 KB) — não ganha nada relevante sendo otimizado, e assim
 * nunca mais depende dessa rota interna pra aparecer.
 */
export function Logo() {
  return (
    <div className="relative overflow-hidden px-4 py-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-msb.png" alt="MSB" width={104} height={32} className="block" />
      <div className="mt-4 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
        <span className="text-[13.5px] font-bold tracking-tight text-foreground">Portal DP</span>
      </div>
      <p className="mt-0.5 pl-3 text-[11px] text-brand-neutral">Departamento Pessoal</p>
      <svg
        viewBox="0 0 240 40"
        className="pointer-events-none absolute -right-10 -bottom-1.5 w-[150px] opacity-50"
        fill="none"
        stroke="var(--brand-accent)"
        strokeWidth={2}
      >
        <path d="M0 20c30-18 60 18 90 0s60-18 90 0 60 18 90 0" />
        <path d="M0 30c30-18 60 18 90 0s60-18 90 0 60 18 90 0" stroke="var(--brand-surface)" />
      </svg>
    </div>
  );
}
