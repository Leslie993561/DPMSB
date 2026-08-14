import { Suspense } from "react";
import { ColaboradoresPageClient } from "@/components/modules/colaboradores/ColaboradoresPageClient";

export const metadata = { title: "Colaboradores — Portal de DP" };

export default function ColaboradoresPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<p className="text-sm text-foreground-muted">Carregando...</p>}>
        <ColaboradoresPageClient />
      </Suspense>
    </div>
  );
}
