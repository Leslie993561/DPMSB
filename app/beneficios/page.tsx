import { Suspense } from "react";
import { BeneficiosPageClient } from "@/components/modules/beneficios/BeneficiosPageClient";

export const metadata = { title: "Benefícios — Portal Recursos Humanos" };

export default function BeneficiosPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<p className="text-sm text-foreground-muted">Carregando...</p>}>
        <BeneficiosPageClient />
      </Suspense>
    </div>
  );
}
