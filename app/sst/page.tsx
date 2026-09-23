import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/shared/Card";

export const metadata = { title: "Dashboard SST — Portal Recursos Humanos" };

export default function SstDashboardPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="SST"
        titulo="Dashboard"
        subtitulo="Segurança e Saúde no Trabalho — Portal Recursos Humanos"
      />
      <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <p className="text-[13px] font-semibold text-foreground">Migração do Portal SST em andamento</p>
        <p className="max-w-sm text-[12px] text-foreground-muted">
          Este módulo está sendo trazido para dentro do Portal Recursos Humanos — sem sair desta página, sem login
          separado.
        </p>
      </Card>
    </div>
  );
}
