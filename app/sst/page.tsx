import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/shared/Card";

export const metadata = { title: "SST — Portal Recursos Humanos" };

export default function SstPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="SST"
        titulo="Segurança e Saúde no Trabalho"
        subtitulo="Nova frente do Portal Recursos Humanos"
      />
      <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <span className="text-2xl" aria-hidden>
          🚧
        </span>
        <p className="text-[13px] font-semibold text-foreground">Módulos de SST em construção</p>
        <p className="max-w-sm text-[12px] text-foreground-muted">
          Esta frente ainda não tem funcionalidades — é o espaço reservado para ASO, CIPA, laudos e demais rotinas
          de Segurança e Saúde no Trabalho.
        </p>
      </Card>
    </div>
  );
}
