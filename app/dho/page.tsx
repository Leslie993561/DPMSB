import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/shared/Card";

export const metadata = { title: "DHO — Portal Recursos Humanos" };

export default function DhoPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="DHO"
        titulo="Desenvolvimento Humano e Organizacional"
        subtitulo="Nova frente do Portal Recursos Humanos"
      />
      <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <p className="text-[13px] font-semibold text-foreground">Dashboard de DHO em construção</p>
        <p className="max-w-sm text-[12px] text-foreground-muted">
          Esta frente ainda não tem indicadores — é o espaço reservado para treinamento, desenvolvimento, clima e
          avaliação de desempenho.
        </p>
      </Card>
    </div>
  );
}
