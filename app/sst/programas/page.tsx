import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/shared/Card";

export const metadata = { title: "Programas SST — Portal Recursos Humanos" };

export default function SstProgramasPage() {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="SST" titulo="Programas SST" subtitulo="PCMSO, PGR e demais programas de saúde ocupacional" />
      <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <p className="text-[13px] font-semibold text-foreground">Módulo em migração</p>
        <p className="max-w-sm text-[12px] text-foreground-muted">
          Ainda está no Portal SST antigo — está sendo trazido para cá em etapas.
        </p>
      </Card>
    </div>
  );
}
