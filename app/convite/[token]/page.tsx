import { ConviteForm } from "./ConviteForm";

export const metadata = { title: "Complete seu cadastro — Portal Recursos Humanos" };

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <div className="flex min-h-screen justify-center bg-surface-page px-4 py-10">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-hairline bg-background shadow-drawer">
        <div className="border-b border-hairline px-6 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-msb.png" alt="MSB" width={104} height={32} className="block" />
          <div className="mt-4 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
            <span className="text-[13.5px] font-bold tracking-tight text-foreground">Portal Recursos Humanos</span>
          </div>
          <p className="mt-0.5 pl-3 text-[11px] text-brand-neutral">Complete seu cadastro</p>
        </div>
        <div className="px-6 py-5">
          <ConviteForm token={token} />
        </div>
      </div>
    </div>
  );
}
