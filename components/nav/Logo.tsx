import Image from "next/image";

/** Logotipo oficial MSB, extraído do arquivo de design do Portal DP. */
export function Logo() {
  return (
    <div className="relative overflow-hidden px-4 py-5">
      <Image src="/logo-msb.png" alt="MSB" width={104} height={32} className="block" priority />
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
