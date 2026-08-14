import { Suspense } from "react";
import { FeriasPageClient } from "@/components/modules/ferias/FeriasPageClient";

export const metadata = { title: "Férias — Portal de DP" };

export default function FeriasPage() {
  return (
    <Suspense fallback={<p className="text-sm text-foreground-muted">Carregando...</p>}>
      <FeriasPageClient />
    </Suspense>
  );
}
