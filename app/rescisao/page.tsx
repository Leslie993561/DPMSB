import { RescisaoForm } from "@/components/modules/rescisao/RescisaoForm";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata = { title: "Rescisão — Portal de DP" };

export default function RescisaoPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Rescisão" titulo="Cálculo de verbas rescisórias" subtitulo="Motor determinístico, com memória de cálculo e base legal" />
      <RescisaoForm />
    </div>
  );
}
