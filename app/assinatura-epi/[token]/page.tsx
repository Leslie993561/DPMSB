import { AssinaturaEpiForm } from "./AssinaturaEpiForm";

export const metadata = { title: "Assinatura da ficha de EPI — Portal Recursos Humanos" };

export default async function AssinaturaEpiPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <div className="flex min-h-screen justify-center bg-surface-page px-4 py-10">
      <div className="h-fit w-full max-w-2xl overflow-hidden rounded-xl border border-hairline bg-background shadow-drawer">
        <div className="border-b border-hairline px-6 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-msb.png" alt="MSB" width={104} height={32} className="block" />
          <div className="mt-4 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
            <span className="text-[13.5px] font-bold tracking-tight text-foreground">Recursos Humanos</span>
          </div>
          <p className="mt-0.5 pl-3 text-[11px] text-brand-neutral">Assinatura da ficha de entrega de EPI</p>
        </div>
        <div className="px-6 py-5">
          <AssinaturaEpiForm token={token} />
        </div>
      </div>
    </div>
  );
}
